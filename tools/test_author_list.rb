# frozen_string_literal: true
#
# Unit tests for the author_list filter (_plugins/author_list.rb).
# Usage: bundle exec ruby tools/test_author_list.rb

require "minitest/autorun"
require_relative "../_plugins/author_list"

class AuthorListTest < Minitest::Test
  def parse(**kw) = Entreluma::AuthorList.parse(**kw)

  def test_single_author
    assert_equal ["Rebecca Friedel"], parse(author: "Rebecca Friedel")
  end

  def test_two_authors_with_and
    assert_equal ["Kira Bre Clingen", "Edyth Jostol"], parse(author: "Kira Bre Clingen and Edyth Jostol")
  end

  def test_serial_comma_and
    assert_equal ["Ashley Thuthao Keng Dam", "Diana Heredia-López", "Rachael Nelson", "Erin Wrightson"],
                 parse(author: "Ashley Thuthao Keng Dam, Diana Heredia-López, Rachael Nelson, and Erin Wrightson")
  end

  def test_ampersand_with_comma
    assert_equal ["Jordan Noelle Smith", "Gianna Welty", "Hayley Blair"],
                 parse(author: "Jordan Noelle Smith, Gianna Welty, & Hayley Blair")
  end

  def test_ampersand_without_comma
    assert_equal ["A Person", "B Person"], parse(author: "A Person & B Person")
  end

  def test_yaml_list_wins
    assert_equal ["Lois Nguyen", "Emily Jane Hughes", "Moira Newman"],
                 parse(authors: ["Lois Nguyen", " Emily Jane Hughes ", "Moira Newman"], author: "Ignored")
  end

  def test_empty_inputs
    assert_equal [], parse
    assert_equal [], parse(author: "  ")
    assert_equal ["X"], parse(authors: [], author: "X")
  end

  def test_names_containing_and_substring
    assert_equal ["Alexandra Anderson"], parse(author: "Alexandra Anderson")
  end
end
