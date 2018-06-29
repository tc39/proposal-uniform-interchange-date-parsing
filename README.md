# Uniform parsing of quasi-standard Date.parse input

A proposal to standardize `Date.parse` behavior for input that is sufficiently similar to the ISO 8601-based [ECMAScript Date Time String Format](https://tc39.github.io/ecma262/#sec-date-time-string-format).

## Status
This proposal is at stage 0 of [the TC39 Process](https://tc39.github.io/process-document/).

## Champions
None yet.

## Motivation
[`Date.parse`](https://tc39.github.io/ecma262/#sec-date.parse) specifies an initial attempt to parse input as an [ECMAScript Date Time String](https://tc39.github.io/ecma262/#sec-date-time-string-format), but all input that does not strictly conform is allowed to fall back to implementation-specific behavior—even if the input divergence was almost certainly unintentional.
As a result, implementations differ in their treatment of such "not-quite right" input in ways that they should not.
Behavior can be explored at https://output.jsbin.com/sujuduraci#test-cases , but here is a summary:
* Chrome, Edge, and Safari accept signed years with the wrong digit count (e.g., "+2018-06-29" and "+0002018-06-29").
* Chrome, Edge, and Safari accept unsigned years with more than four digits (e.g., "123456-10-12").
* Chrome and Edge interpret out-of-bounds dates up to 31 (e.g., "2018-02-30") as specifying a date in the following month.
* Chrome accepts lowercase time designators and/or time zone offsets (e.g., "2018-06-29t15:00z").
* Edge accepts nonzero minutes and/or seconds when the hour is 24 (e.g., "2018-06-28T24:01:01Z").
* Safari accepts a seconds value of 60 (e.g., "2015-06-30T23:59:60Z").
* Chrome and Edge accept "Z" offsets in the absense of a time component. Edge further accepts other letters (e.g., "2018-06-29E").
* Edge accepts hh:mm time zone offsets in the absense of a time component (e.g., "2018-06-29-04:00").
* Edge accepts hours-only time zone offsets, but only with a fully-specified date component (e.g., "2018-06-29T11:00-04").
* Edge and Safari accept out-of-bounds time zone offsets (e.g., "2018-06-28T15:00-24:00").
* Chrome, Edge, Firefox, and Safari accept too few or too many fractional second digits (e.g., "2018-06-29T11:00:12.3456").

## Proposed Solution
Define a format that encompasses both the [Date Time String Format](https://tc39.github.io/ecma262/#sec-date-time-string-format) and small variations therefrom—especially those that are valid [ISO 8601 date and time representations](https://www.loc.gov/standards/datetime/iso-tc154-wg5_n0038_iso_wd_8601-1_2016-02-16.pdf)—and standardize `Date.parse` treatment of input conforming to it.

### Background
[Date Time String Format](https://tc39.github.io/ecma262/#sec-date-time-string-format) defines a "string interchange format for date-times" that is based on ISO 8601 extended format calendar date and time representations.
It is in fact a subset thereof, with the exception of allowing "24" for hour (which ISO 8601 permits only within time _interavals_).
[`Date.prototype.toISOString`](https://tc39.github.io/ecma262/#sec-date.prototype.toisostring) returns strings conforming to it, and [`Date.parse`](https://tc39.github.io/ecma262/#sec-date.parse) is required to accept conforming strings and correctly interpret them as ISO 8601.
I believe the format is exactly described by the following regular expression (ignoring whitespace, which is only provided with the hope of improving readability):
```js
/^
  (?<year> [0-9]{4} | [+-][0-9]{6} )
  (
    -(?<month> 0[1-9] | 1[0-2] )
    (
      -(?<day> 0[1-9] | [12][0-9] | 3[01] )
    )?
  )?
  (
    T(?<hour> [01][0-9] | 2[0-4] ):(?<minute> [0-5][0-9] )
    (
      :(?<second> [0-5][0-9] )
      (?<fraction> \.[0-9]{3} )?
    )?
    (?<offset> Z | [+-] ( [01][0-9] | 2[0-4] ):( [0-5][0-9] ) )?
  )?
$/
```
Every current implementation I could find correctly interprets a superset of this format as would be expected.

### Changes
Specify the behavior of `Date.parse` not just for input conforming to the interchange format, but to a superset of it that encompasses both more of ISO 8601 and also invalid neighbors of valid input that may fail e.g. bounds checks or decimal localization or uppercase rules:
```js
/^
  (?<yearish> [0-9]{4} | [+-][0-9]{4,} )
  (
    -(?<monthish> [0-9]{2} )
    (
      -(?<dayish> [0-9]{2} )
    )?
  )?
  (
    T(?<hourish> [0-9]{2} ):(?<minuteish> [0-9]{2} )
    (
      :(?<secondish> [0-9]{2} )
      (?<fraction> [.,][0-9]+ )?
    )?
  )?
  (?<offsetish> Z | [+-] [0-9]{2}:[0-9]{2} )?
$/i
```
Implementation-specific parsing will only be allowed for input that is clearly not intended as or based upon the standard interchange format.
Ordered into sequential suggestions (expecting the later ones to be increasingly controversial and noting that this proposal can survive a cutoff point partway or all of the way through any chunk):

1. Use correct vocabulary for sign-prefixed years ("expanded", not "extended") and be specific about basing the ECMAScript format upon ISO 8601 _calendar date_ formats (in contrast with YYYY-DDD _ordinal date_ and YYYY-Www-D _week date_ formats).
Reject input that does not match the intersection of ISO 8601 and the currently-documented ECMAScript Date Time String Format.
   * If <var>yearish</var> is sign-prefixed but has a digit count other than six, return `NaN`.
   * If <var>monthish</var> is present but not 01 through 12, return `NaN`.
   * If <var>dayish</var> is present but equals 00 or exceeds the number of days in the given month and year, return `NaN`.
   * If <var>hourish</var> exceeds 23, return `NaN` (breaking current acceptance of "…T24:00:00", but see below).
   * If <var>minuteish</var> exceeds 59, return `NaN`.
   * If <var>secondish</var> exceeds 59, return `NaN`.
   * If <var>fraction</var> contains a comma, return `NaN`.
   * If <var>fraction</var> is present but does not have exactly three digits, return `NaN`.
   * If <var>offsetish</var> is present without a time component, return `NaN`.
   * If <var>offsetish</var> hour exceeds 23 or minute exceeds 59, return `NaN`.
   * If the input contains a lowercase letter, return `NaN`.

2. Add allowances for reasonable and/or backwards-compatible input acceptance.
   * If <var>hourish</var> is 24 and <var>minuteish</var> is 00 and <var>secondish</var> is 00, allow interpretation as an "end of day" midnight (restoring acceptance of "…T24:00:00") and update the text to indicate that such input is technically invalid ISO 8601.
   * If <var>fraction</var> is present and has fewer than three digits, act as if the missing rightmost digits were 0.
   * If <var>fraction</var> has more than three digits, allow implementations to accept it but do not specify the effect of excess digits.
   * If <var>yearish</var> is sign-prefixed and has at least four digits but no more than six after stripping leading zeroes, act as if it had exactly six digits.
   * Interpret lowercase letters as uppercase
     * [ISO 8601-1 §3.4.1](https://www.loc.gov/standards/datetime/iso-tc154-wg5_n0038_iso_wd_8601-1_2016-02-16.pdf#page=18): "_In date and time representations lower case characters may be used when upper case characters are not available._"

3. Loosen the similarity requirement to require rejection of more input, including more input that is valid ISO 8601 calendar date/date-time but does not match the ECMAScript Date Time String Format.
   * Allow both flavors of <var>yearish</var> to have four or more digits (e.g., `(?<yearish> [0-9]{4,} | [+-][0-9]{4,} )`) and return `NaN` if <var>yearish</var> has more than four but is not sign-prefixed.
   * Allow a space or tab character in place of time designator "T" (e.g., `[T\x20\t]`, and return `NaN` in such cases.
   * Allow <var>fraction</var> to match a decimal sign (dot or comma) with no digits (e.g., `(?<fraction> [.,][0-9]* )`), and return `NaN` if it does so.
   * Allow <var>fraction</var> to match a partial minute or partial hour (e.g., `T(?<hourish> [0-9]{2} )((?<hourFraction> [.,][0-9]+ )? | :(?<minuteish> [0-9]{2} )(:(?<secondish> [0-9]{2} ))?(?<fraction> [.,][0-9]+ )?)`), and return `NaN` if it does so.
   * Allow <var>offsetish</var> without a minutes component (e.g., `(?<offsetish> Z | [+-][0-9]{2}(:[0-9]{2})? )`), and return `NaN` in such cases.

4. Accept more input that is invalid ECMAScript Date Time String Format but is potentially valid ISO 8601.
   * If <var>yearish</var> is sign-prefixed and has more than six digits but specifies an in-range year, act as if it had exactly six digits.
   * If the time designator is a space or tab, act as if it were a "T".
     * [ISO 8601-1 §4.3.2](https://www.loc.gov/standards/datetime/iso-tc154-wg5_n0038_iso_wd_8601-1_2016-02-16.pdf#page=27): "_By mutual agreement of the partners in information interchange, the character [T] may be omitted in applications where there is no risk of confusing a date and time of day representation with others defined in this International Standard._"
   * If <var>offsetish</var> has no minutes component, act as if the minutes component were 00.
     * [ISO 8601-1 §4.2.5.1](https://www.loc.gov/standards/datetime/iso-tc154-wg5_n0038_iso_wd_8601-1_2016-02-16.pdf#page=25): "_When it is required to indicate the difference between local time and UTC of day, the representation of the difference can be expressed in hours and minutes, or hours only._"
   * If <var>fraction</var> contains a comma, act as if it were a dot.
      * [ISO 8601-1 §4.2.2.4](https://www.loc.gov/standards/datetime/iso-tc154-wg5_n0038_iso_wd_8601-1_2016-02-16.pdf#page=24): "_the decimal fraction shall be divided from the integer part by the decimal sign specified in ISO 31-0, i.e. the comma [,] or full stop [.]._"

### Other potential extensions
* Accept unsigned long years.
* Accept fractional minutes or hours.
* Specify uniform treatment for non-"Z" character time zone offsets.

## Discussion
### Backwards Compatibility
This is by design an area of wide variance between implementations, but none of the proposed changes would require any input that is currently accepted by all of them to start being rejected.
