#!/usr/bin/env ruby
# frozen_string_literal: true

require 'find'

directory = ARGV.fetch(0) do
  warn 'Usage: ruby tools/check_deployment_size.rb <deployment-directory> [maximum-bytes]'
  exit 2
end
maximum = Integer(ARGV.fetch(1, '900000000'), 10)

unless Dir.exist?(directory)
  warn "Deployment directory does not exist: #{directory}"
  exit 2
end

files = []
Find.find(directory) do |entry|
  next unless File.file?(entry)

  files << [File.size(entry), entry]
end

total = files.sum(&:first)
puts format('Deployment size: %.1f MB (%d bytes across %d files)', total / 1_000_000.0, total, files.length)
puts format('Deployment budget: %.1f MB (%d bytes)', maximum / 1_000_000.0, maximum)

if total > maximum
  warn format('ERROR: deployment exceeds its size budget by %.1f MB.', (total - maximum) / 1_000_000.0)
  warn 'Largest deployment files:'
  files.max_by(20, &:first).each do |size, entry|
    warn format('  %8.1f MB  %s', size / 1_000_000.0, entry.delete_prefix("#{directory}/"))
  end
  exit 1
end

puts format('Deployment has %.1f MB of headroom.', (maximum - total) / 1_000_000.0)
