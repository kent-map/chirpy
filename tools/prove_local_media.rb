# M0 production path proof: real Jekyll, repository includes and post layout.
# Copies the site and fixtures into a disposable repository; source stays untouched.
ENV['JEKYLL_ENV'] = 'production'
require 'bundler/setup'
require 'jekyll'
require 'tmpdir'
require 'json'
require 'cgi'
require 'uri'

require 'fileutils'
require 'base64'
require 'zlib'
require 'digest'

root = File.expand_path('..', __dir__)
results = []
Dir.mktmpdir('entreluma-media-proof-') do |output|
  source = File.join(output, 'source')
  FileUtils.mkdir_p(source)
  %w[_config.yml _includes _layouts _plugins _data _posts _tabs assets index.html].each do |entry|
    FileUtils.cp_r(File.join(root, entry), source)
  end
  %w[conventional custom external root].each do |name|
    media = { 'conventional' => '/assets/posts/proof', 'custom' => '/assets/img',
              'external' => 'https://media.example/story', 'root' => '/assets/posts/proof' }[name]
    src = name == 'root' ? '/assets/posts/proof/photo.png' : 'photo.png'
    File.write(File.join(source, "_posts/2026-01-01-local-proof-#{name}.md"), <<~POST)
      ---
      title: Local proof #{name}
      layout: post
      date: 2026-01-01
      permalink: /local-proof/#{name}/
      media_subpath: #{media}
      #{name == 'conventional' ? 'entreluma_workspace: local-proof' : ''}
      ---
      ![Fixture colors](#{src})

      {% include embed/image.html id="proof" src="#{src}" %}

      {% include embed/map.html id="data-proof" geojson="#{src.sub('photo.png', 'data.geojson')}~Lake" %}

      [Download CSV](<{{ '/assets/posts/proof/data.csv' | relative_url }}>)
    POST
  end
  png_chunk = ->(kind, data) { [data.bytesize].pack('N') + kind + data + [Zlib.crc32(kind + data)].pack('N') }
  pixels = "\x89PNG\r\n\x1a\n".b + png_chunk.call('IHDR', [1, 1, 8, 6, 0, 0, 0].pack('NNCCCCC')) +
    png_chunk.call('IDAT', Zlib.deflate("\x00\xff\x00\x00\xff".b)) + png_chunk.call('IEND', ''.b)
  %w[assets/posts/proof assets/img].each do |path|
    FileUtils.mkdir_p(File.join(source, path))
    File.binwrite(File.join(source, path, 'photo.png'), pixels)
    File.write(File.join(source, path, 'data.geojson'), '{"type":"FeatureCollection","features":[]}')
    File.binwrite(File.join(source, path, 'data.csv'), "name,value\r\nLake,1\r\n")
  end
  FileUtils.mkdir_p(File.join(source, '_data/entreluma_workspaces'))
  File.write(File.join(source, '_data/entreluma_workspaces/local-proof.json'), JSON.generate({
    schemaVersion: 1, workspaceId: 'local-proof', entryPath: '_posts/2026-01-01-local-proof-conventional.md',
    files: [{ assetId: 'photo', path: 'assets/posts/proof/photo.png', mime: 'image/png', size: pixels.bytesize, width: 1, height: 1, displayName: 'photo.png', contentHash: Digest::SHA256.hexdigest(pixels) }]
  }))
  # The real post-lastmod hook reads Git history. Use a disposable local commit
  # so it runs unchanged without noisy missing-HEAD errors for the fixtures.
  raise 'git init failed' unless system('git', 'init', '-q', source)
  raise 'git add failed' unless system('git', '-C', source, 'add', '_posts')
  raise 'fixture commit failed' unless system('git', '-C', source, '-c', 'user.name=Entreluma fixture',
    '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Fixture source')
  ['', '/project'].product(['', 'https://cdn.example', 'https://res.cloudinary.com/example/image/fetch']).each_with_index do |(baseurl, cdn), index|
    site = Jekyll::Site.new(Jekyll.configuration('source' => source, 'destination' => File.join(output, 'build-' + index.to_s),
      'url' => 'https://site.example', 'baseurl' => baseurl, 'cdn' => cdn,
      'quiet' => true, 'disable_disk_cache' => true))
    Dir.chdir(source) { site.process }
    raise 'image bytes changed in build' unless File.binread(File.join(site.dest, 'assets/posts/proof/photo.png')) == pixels
    %w[conventional custom external root].each do |name|
      html = File.read(File.join(site.dest, 'local-proof', name, 'index.html'))
      image = CGI.unescapeHTML(html[/<img\b[^>]*src="([^"]+)"[^>]*alt="Fixture colors"/, 1] ||
                               html[/<img\b[^>]*alt="Fixture colors"[^>]*src="([^"]+)"/, 1] || '')
      viewer = CGI.unescapeHTML(html[/<iframe\b[^>]*\bid="proof"[^>]*src="([^"]+)"/, 1] || '')
      viewer_src = CGI.parse(URI.parse(viewer).query || '')['src'].first
      raise "missing rendered images (#{name})" if image.empty? || !viewer_src
      expected_path = case name
        when 'custom' then '/assets/img/photo.png'
        when 'external' then 'https://media.example/story/photo.png'
        else '/assets/posts/proof/photo.png'
      end
      expected = if name == 'external'
        cdn.include?('cloudinary') ? "#{cdn}/#{expected_path}" : expected_path
      elsif cdn.include?('cloudinary')
        "#{cdn}/https://site.example#{baseurl}#{expected_path}"
      elsif !cdn.empty?
        "#{cdn}#{expected_path}"
      else
        "https://site.example#{baseurl}#{expected_path}"
      end
      absolute_image = image.start_with?('/') ? "https://site.example#{image}" : image
      raise "Markdown path mismatch: #{[name, baseurl, cdn, absolute_image, expected].inspect}" unless absolute_image == expected
      raise "Viewer path mismatch: #{[name, baseurl, cdn, viewer_src, expected].inspect}" unless viewer_src == expected
      map = CGI.unescapeHTML(html[/<iframe\b[^>]*\bid="data-proof"[^>]*src="([^"]+)"/, 1] || '')
      geojson = CGI.parse(URI.parse(map).query || '')['geojson'].first
      geojson = 'https://site.example' + geojson if geojson&.start_with?('/')
      data_expected = expected.sub('photo.png', 'data.geojson')
      data_expected = data_expected.delete_prefix(cdn + '/') if cdn.include?('cloudinary')
      raise "Map data path mismatch: #{[geojson, data_expected].inspect}" unless geojson == data_expected + '~Lake'
      raise 'Download base path mismatch' unless html.include?(%Q{href="#{baseurl}/assets/posts/proof/data.csv"})
      raise 'Data bytes changed' unless File.binread(File.join(site.dest, 'assets/posts/proof/data.csv')) == "name,value\r\nLake,1\r\n"
      raise 'temporary URL leaked to Jekyll' if html.include?('blob:') || html.include?('sk_resource=')
      raise 'manifest emitted as public file' if File.exist?(File.join(site.dest, '_data/entreluma_workspaces/local-proof.json'))
      results << { baseurl: baseurl, cdn: cdn, media: name, image: image, viewer: viewer_src }
    end
  end
end
puts JSON.pretty_generate(results)
