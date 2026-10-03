Pod::Spec.new do |s|
  s.name = 'AppIcon'
  s.version = '1.0.0'
  s.summary = 'ichiro app icon selection'
  s.description = 'Select bundled launcher icons on this device.'
  s.author = 'ichiro'
  s.homepage = 'https://github.com/matsupiee/ichiro'
  s.license = { :type => 'MIT' }
  s.platforms = { :ios => '16.4' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
end
