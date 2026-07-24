require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name         = 'ChimeraCamera'
  s.version      = package['version']
  s.summary      = package['description']
  s.license      = { :type => 'MIT', :file => 'LICENSE' }
  s.authors      = 'Kealan Clarke'
  s.homepage     = 'https://github.com/KealanAU/chimera-camera'
  s.source       = { :git => 'https://github.com/KealanAU/chimera-camera.git', :tag => "v#{s.version}" }

  s.platform     = :ios, '15.0'
  s.swift_version = '5.0'
  s.source_files = 'ios/**/*.{h,m,swift}'
  s.frameworks   = 'AVFoundation', 'Photos', 'UIKit'

  # Unpinned on purpose: the host app pins Lynx to its own release, and this
  # pod must resolve to whatever that is.
  s.dependency 'Lynx'

  # ChimeraCameraView self-registers via LYNX_LAZY_REGISTER_UI, which Lynx finds
  # by scanning loaded classes. Nothing references the class at link time, so a
  # static-library build strips its object file and <camera-view> silently never
  # registers. -ObjC keeps it.
  s.user_target_xcconfig = { 'OTHER_LDFLAGS' => '-ObjC' }
end
