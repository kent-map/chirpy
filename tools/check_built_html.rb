#!/usr/bin/env ruby
# frozen_string_literal: true
#
# Assertions on the built site that html-proofer does not cover.
#
# Usage: bundle exec ruby tools/check_built_html.rb [_site]
#
# Fails if any essay page (identified by its citation_title tag) has:
#   - an href that is raw Entreluma shorthand: ^Q\d+$ or <target>/(zoomto|flyto|playat)/
#   - an og:image or JSON-LD image that is not an https:// URL
#   - no citation_title, citation_author or citation_publication_date
#   - other than exactly one application/ld+json block
# Also fails if any built page contains shorthand hrefs, if robots.txt disallows
# "/" or blocks a search/AI crawler, or (when _config.yml sets `sitemap: false`
# for the admin collection) if the sitemap lists /admin/ pages.

require "json"
require "date"
require "yaml"
require "nokogiri"

SITE = ARGV[0] || "_site"
SHORTHAND = %r{\A(?:Q\d+|(?:\./)?[\w-]+/(?:zoomto|flyto|playat)/)}.freeze
CRAWLERS = %w[GPTBot ClaudeBot PerplexityBot Google-Extended Bingbot].freeze

errors = []
essays = 0

Dir.glob(File.join(SITE, "**", "*.html")).sort.each do |path|
  next if path.include?("/assets/components/")

  rel = path.delete_prefix("#{SITE}/")
  doc = Nokogiri::HTML5(File.read(path, encoding: "UTF-8"), max_tree_depth: -1)

  doc.css("a[href]").each do |a|
    errors << "#{rel}: shorthand href #{a['href'].inspect}" if a["href"].to_s.strip.match?(SHORTHAND)
  end

  next unless doc.at_css('meta[name="citation_title"]')

  essays += 1
  %w[citation_author citation_publication_date].each do |name|
    errors << "#{rel}: missing #{name}" unless doc.at_css(%(meta[name="#{name}"]))
  end

  og = doc.at_css('meta[property="og:image"]')&.[]("content").to_s
  errors << "#{rel}: og:image is not https: #{og.inspect}" unless og.start_with?("https://")

  blocks = doc.css('script[type="application/ld+json"]')
  if blocks.size != 1
    errors << "#{rel}: #{blocks.size} JSON-LD blocks (expected 1)"
  else
    begin
      ld = JSON.parse(blocks.first.text)
      image = ld["image"].is_a?(Hash) ? ld["image"]["url"] : ld["image"]
      errors << "#{rel}: JSON-LD image is not https: #{image.inspect}" unless image.to_s.start_with?("https://")
      authors = Array(ld["author"])
      errors << "#{rel}: JSON-LD has no authors" if authors.empty?
    rescue JSON::ParserError => e
      errors << "#{rel}: JSON-LD does not parse (#{e.message[0, 80]})"
    end
  end
end

errors << "no essay pages found in #{SITE} (no citation_title tags)" if essays.zero?

admin_hidden =
  begin
    config = YAML.safe_load_file("_config.yml", permitted_classes: [Date, Time]) || {}
    Array(config["defaults"]).any? do |d|
      d.dig("scope", "type") == "admin" && d.dig("values", "sitemap") == false
    end
  rescue StandardError
    false
  end

sitemap = File.join(SITE, "sitemap.xml")
if admin_hidden && File.exist?(sitemap)
  admin = File.read(sitemap).scan(%r{<loc>[^<]*/admin/[^<]*</loc>})
  errors << "sitemap.xml lists #{admin.size} /admin/ URLs" unless admin.empty?
end

robots = File.join(SITE, "robots.txt")
if File.exist?(robots)
  agents = []
  in_rules = false
  File.foreach(robots) do |raw|
    line = raw.sub(/#.*/, "").strip
    next if line.empty?

    key, value = line.split(":", 2).map { |s| s.to_s.strip }
    case key.downcase
    when "user-agent"
      agents = [] if in_rules
      in_rules = false
      agents << value
    when "disallow", "allow"
      in_rules = true
      next unless key.casecmp?("disallow") && !value.empty?

      errors << "robots.txt disallows / for #{agents.join(', ')}" if value == "/"
      named = agents & CRAWLERS
      errors << "robots.txt blocks #{named.join(', ')} (#{value})" unless named.empty?
    end
  end
end

if errors.empty?
  puts "Built HTML checks passed (#{essays} essays)."
else
  warn errors.first(200).map { |e| "  #{e}" }
  warn "Built HTML checks failed: #{errors.size} problem(s)."
  exit 1
end
