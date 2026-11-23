# frozen_string_literal: true
#
# Liquid filter: author_list
#
#   {{ page | author_list }}  -> ["Kira Bre Clingen", "Edyth Jostol"]
#
# Uses the `authors:` YAML list when present; otherwise splits the `author:`
# string on ", and ", ", & ", " and ", " & " and ", " (longest first).
# Used for citation_author tags, JSON-LD authors and the Cite This dialog.

module Entreluma
  module AuthorList
    SEPARATORS = /,\s+and\s+|,\s*&\s*|\s+and\s+|\s+&\s+|,\s*/.freeze

    module_function

    def parse(authors: nil, author: nil)
      list =
        if authors.is_a?(Array) && !authors.empty?
          authors.flat_map { |a| a.is_a?(Hash) ? [a["name"]] : [a] }
        elsif authors.is_a?(String) && !authors.strip.empty?
          authors.split(SEPARATORS)
        elsif author.is_a?(Array)
          author
        elsif author
          author.to_s.split(SEPARATORS)
        else
          []
        end
      list.map { |name| name.to_s.strip }.reject(&:empty?)
    end
  end

  module AuthorListFilter
    def author_list(input)
      data =
        if input.respond_to?(:to_liquid) && input.to_liquid.respond_to?(:[])
          input.to_liquid
        else
          input
        end
      if data.is_a?(String) || data.is_a?(Array)
        AuthorList.parse(author: data)
      else
        AuthorList.parse(authors: data["authors"], author: data["author"])
      end
    end
  end
end

Liquid::Template.register_filter(Entreluma::AuthorListFilter) if defined?(Liquid::Template)
