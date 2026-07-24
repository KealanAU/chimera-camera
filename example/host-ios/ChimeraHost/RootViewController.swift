import Lynx
import UIKit

/// Loads a Lynx bundle from the rspeedy dev server into a LynxView, with the
/// package's native CameraModule registered and <camera-view> compiled in.
///
/// Auto-discovers the dev server: a post-build phase
/// (project.yml "Write dev server host") bakes the Mac's LAN IP into the app as
/// DevServerHost.txt, and on launch we scan the rspeedy port range for the first
/// server that answers — so you never type a URL and never get trapped on
/// localhost. The URL bar is a manual override (e.g. the Vue dev server on
/// another port, or a tunnel).
final class RootViewController: UIViewController {
  private let devServerPorts = Array(3000...3010)

  // The Mac's LAN IP, written into the app bundle at build time. localhost
  // fallback for the simulator (where loopback reaches the Mac).
  private let devServerHost: String = {
    guard let url = Bundle.main.url(forResource: "DevServerHost", withExtension: "txt"),
          let contents = try? String(contentsOf: url, encoding: .utf8)
    else { return "localhost" }
    let host = contents.trimmingCharacters(in: .whitespacesAndNewlines)
    return host.isEmpty ? "localhost" : host
  }()

  private let urlField = UITextField()
  private let loadButton = UIButton(type: .system)
  private let container = UIView()
  private let statusLabel = UILabel()
  private var lynxView: LynxView?
  private var started = false
  private var loaded = false
  private var pendingURL: String?
  private var loadingSavedURL = false
  private let savedURLKey = "ChimeraHost.lastBundleURL"

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .black

    urlField.borderStyle = .roundedRect
    urlField.autocapitalizationType = .none
    urlField.autocorrectionType = .no
    urlField.keyboardType = .URL
    urlField.clearButtonMode = .whileEditing
    urlField.returnKeyType = .go
    urlField.delegate = self
    urlField.placeholder = "auto-discovering… or type http://<ip>:3000/main.lynx.bundle"

    loadButton.setTitle("Load", for: .normal)
    loadButton.addTarget(self, action: #selector(loadTapped), for: .touchUpInside)

    // Auto-discovery handles the normal path, so the URL bar stays hidden and the
    // camera fills the screen. It's revealed only when discovery fails (manual
    // override), then hidden again once a bundle loads.
    urlField.isHidden = true
    loadButton.isHidden = true

    statusLabel.numberOfLines = 0
    statusLabel.textColor = .white
    statusLabel.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
    statusLabel.isHidden = true

    view.addSubview(urlField)
    view.addSubview(loadButton)
    view.addSubview(container)
    view.addSubview(statusLabel)
    // Load is deferred to viewDidLayoutSubviews: `container` has no size yet, and
    // a LynxView built at 0x0 in .exact mode renders the whole bundle blank.
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    let safe = view.safeAreaInsets
    let top = safe.top + 8
    let pad: CGFloat = 12
    let buttonWidth: CGFloat = 64
    let rowHeight: CGFloat = 36
    urlField.frame = CGRect(
      x: pad, y: top,
      width: view.bounds.width - pad * 3 - buttonWidth, height: rowHeight)
    loadButton.frame = CGRect(
      x: view.bounds.width - pad - buttonWidth, y: top,
      width: buttonWidth, height: rowHeight)
    // Full-bleed camera: the LynxView owns the whole screen; the URL row (hidden
    // unless discovery fails) overlays the top when shown.
    container.frame = view.bounds
    lynxView?.frame = container.bounds
    let statusTop = top + rowHeight + 8
    statusLabel.frame = CGRect(
      x: pad + 4, y: statusTop,
      width: view.bounds.width - (pad + 4) * 2, height: view.bounds.height - statusTop - 16)

    if !started, container.bounds.width > 0, container.bounds.height > 0 {
      started = true
      // Prefer the last URL that actually loaded, so a cold start "just works"
      // without retyping. First run (or a stale saved URL) falls back to discovery.
      if let saved = UserDefaults.standard.string(forKey: savedURLKey), !saved.isEmpty {
        urlField.text = saved
        loadingSavedURL = true
        load(bundleURL: saved)
      } else {
        discoverAndLoad()
      }
    }
  }

  @objc private func loadTapped() {
    urlField.resignFirstResponder()
    if let text = urlField.text, !text.isEmpty {
      load(bundleURL: text) // manual override
    } else {
      discoverAndLoad()
    }
  }

  /// Scans the rspeedy port range on the Mac's LAN IP; loads the first that answers.
  private func discoverAndLoad() {
    let range = "\(devServerPorts.first!)–\(devServerPorts.last!)"
    // Discover silently — the screen stays black (like a camera warming up) until
    // the bundle paints. No "loading" chrome on the happy path; status + the URL
    // override bar appear only if discovery fails.
    discoverDevServer { [weak self] found in
      DispatchQueue.main.async {
        guard let self else { return }
        if let found {
          self.urlField.text = found
          self.load(bundleURL: found)
        } else {
          self.urlField.isHidden = false
          self.loadButton.isHidden = false
          self.showStatus("""
            Couldn't find the dev server.

            Scanned http://\(self.devServerHost):\(range)/main.lynx.bundle.

            Run `pnpm --filter @chimera-camera/react run dev` in chimera-camera, \
            keep the phone on the same Wi-Fi/hotspot as the Mac, then tap Load. \
            If iOS asked to allow local network access, tap Allow and retry. \
            You can also type a URL above to override.
            """)
        }
      }
    }
  }

  /// Probes each candidate port with a cheap HEAD request; first HTTP 2xx wins.
  private func discoverDevServer(completion: @escaping (String?) -> Void) {
    func tryPort(at index: Int) {
      guard index < devServerPorts.count else { completion(nil); return }
      let candidate = "http://\(devServerHost):\(devServerPorts[index])/main.lynx.bundle"
      guard let url = URL(string: candidate) else { tryPort(at: index + 1); return }
      var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 1.0)
      request.httpMethod = "HEAD"
      URLSession.shared.dataTask(with: request) { _, response, _ in
        if let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) {
          completion(candidate)
        } else {
          tryPort(at: index + 1)
        }
      }.resume()
    }
    tryPort(at: 0)
  }

  private func load(bundleURL: String) {
    loaded = false
    pendingURL = bundleURL
    statusLabel.isHidden = true
    lynxView?.removeFromSuperview()

    let config = LynxConfig(provider: DevServerTemplateProvider())
    config.register(ChimeraCameraModule.self)

    let lynx = LynxView { builder in
      builder.config = config
      builder.screenSize = self.container.bounds.size
      builder.fontScale = 1.0
    }
    lynx.preferredLayoutWidth = container.bounds.width
    lynx.preferredLayoutHeight = container.bounds.height
    lynx.layoutWidthMode = .exact
    lynx.layoutHeightMode = .exact
    lynx.frame = container.bounds
    lynx.addLifecycleClient(self)
    container.addSubview(lynx)
    lynx.loadTemplate(fromURL: bundleURL, initData: nil)
    lynxView = lynx
  }

  private func showStatus(_ message: String) {
    statusLabel.text = message
    statusLabel.isHidden = false
  }
}

extension RootViewController: UITextFieldDelegate {
  func textFieldShouldReturn(_ textField: UITextField) -> Bool {
    loadTapped()
    return true
  }
}

extension RootViewController: LynxViewLifecycle {
  func lynxView(_ view: LynxView!, didLoadFinishedWithUrl url: String!) {
    DispatchQueue.main.async {
      self.loaded = true
      self.loadingSavedURL = false
      // Remember the URL that worked; next cold start loads it straight away.
      if let url = self.pendingURL { UserDefaults.standard.set(url, forKey: self.savedURLKey) }
      self.statusLabel.isHidden = true
      self.urlField.isHidden = true
      self.loadButton.isHidden = true
    }
  }

  // Surface load failures instead of blanking — bundle unreachable, ATS block,
  // a JS startup throw, etc. Errors after a successful paint stay console-only.
  func lynxView(_ view: LynxView!, didRecieveError error: Error!) {
    let message = error.map { String(describing: $0) } ?? "unknown error"
    NSLog("ChimeraHost lynx error: %@", message)
    DispatchQueue.main.async {
      guard !self.loaded else { return }
      // A saved URL that no longer resolves (Mac IP changed) → rediscover once
      // instead of dead-ending on an error screen.
      if self.loadingSavedURL {
        self.loadingSavedURL = false
        self.discoverAndLoad()
        return
      }
      self.urlField.isHidden = false
      self.loadButton.isHidden = false
      self.showStatus("Couldn't load the bundle:\n\n\(message)")
    }
  }
}

/// Fetches the bundle over HTTP from the rspeedy dev server. Framework-agnostic:
/// the same host loads the React or the Vue bundle depending on which dev server
/// is up.
final class DevServerTemplateProvider: NSObject, LynxTemplateProvider {
  func loadTemplate(withUrl url: String!, onComplete callback: LynxTemplateLoadBlock!) {
    guard let url, let parsed = URL(string: url) else {
      callback(nil, NSError(
        domain: "ChimeraHost", code: -1,
        userInfo: [NSLocalizedDescriptionKey: "Invalid bundle URL: \(url ?? "nil")"]))
      return
    }
    URLSession.shared.dataTask(with: parsed) { data, _, error in
      if let data {
        callback(data, nil)
      } else {
        callback(nil, error ?? NSError(
          domain: "ChimeraHost", code: -2,
          userInfo: [NSLocalizedDescriptionKey: "No data from \(url)"]))
      }
    }.resume()
  }
}
