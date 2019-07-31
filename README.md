# Uniform parsing of quasi-standard Date.parse input

A proposal to standardize `Date.parse` behavior for a broader range of input, accepting more of RFC 3339 and requiring rejection of input including invalid element combinations or whose digits violate bounds, while still allowing implementation-defined fallbacks for _other_ input.

[2019-03 slides](https://docs.google.com/presentation/d/1LuJzeR7Y-e-LcQObQesJfJsIVGkiZCMoZhVMO5OxIoc/edit)

## Status
This proposal is at stage 1 of [the TC39 Process](https://tc39.github.io/process-document/).

## Champions
* Richard Gibson
* Mathias Bynens

## Motivation
[ECMAScript Date Time String Format](https://tc39.github.io/ecma262/#sec-date-time-string-format) defines a [ <strong>±<em>YY</em></strong> ] <strong><em>YYYY</em></strong> [ <strong>-<em>MM</em></strong> [ <strong>-<em>DD</em></strong> ] ] [ <strong>T<em>HH</em>:<em>mm</em></strong> [ <strong>:<em>ss</em></strong> [ <strong>.<em>sss</em></strong> ] ] [ <strong><em>Z</em></strong> ] ] "string interchange format for date-times" that is based on ISO 8601 extended format calendar date and time representations and specifically the RFC 3339 profile.
It is essentially an ISO 8601-2 [profile](https://dotat.at/tmp/ISO_8601-201x-2-DIS.pdf#page=26), with the exceptions of allowing "24" for hour (which ISO 8601 permits only within time _intervals_) and use of reduced precision date representations (omitting day-of-month or both month and day-of-month elements) in combined date and time of day representations (e.g., "2018-07T10:23").
[`Date.prototype.toISOString`](https://tc39.github.io/ecma262/#sec-date.prototype.toisostring) returns strings conforming to it, and [`Date.parse`](https://tc39.github.io/ecma262/#sec-date.parse) is required to accept conforming strings and correctly interpret them as ISO 8601.

This superficially _seems_ to support the desirable developer confidence that any string purported to be an instance of the format will be handled identically by any correct `Date.parse` implementation, but in fact does not because that function is allowed to fall back to implementation-specific behavior for all input that does not strictly conform—even if the divergence was out-of-bounds field values/combinations/etc. ("_Illegal values (out-of-bounds as well as syntax errors) in a format string means that the format string is not a valid instance of this format_").
As a result, implementations differ in their treatment of such "not-quite right" input in ways that they should not.
Behavior can be explored at https://jsbin.com/kuyubexitu (approximated [in this repository](https://tc39.github.io/proposal-uniform-interchange-date-parsing/cases.html)), but here is a summary:
* Chrome, Edge, and Safari accept signed years with the wrong digit count (e.g., "+2018-06-29" and "+0002018-06-29").
* Chrome, Edge, and Safari accept unsigned years with more than four digits (e.g., "123456-10-12").
* Chrome and Edge interpret out-of-bounds days up to 31 (e.g., "2018-02-30") as specifying a date in the following month.
* Chrome accepts lowercase time designators and/or time zone offsets (e.g., "2018-06-29t15:00z").
* Edge accepts nonzero minutes and/or seconds when the hour is 24 (e.g., "2018-06-28T24:01:01Z").
* Safari accepts a seconds value of 60 (e.g., "2015-06-30T23:59:60Z"), interpreted as end-of-minute.
* Chrome and Edge accept "Z" offsets in the absence of a time component. Edge further accepts other letters (e.g., "2018-06-29E"), interpreted as [military time zones](https://en.wikipedia.org/wiki/List_of_military_time_zones).
* Edge accepts hh:mm time zone offsets in the absence of a time component (e.g., "2018-06-29-04:00").
* Edge accepts hours-only time zone offsets, but only with a fully-specified date component (e.g., "2018-06-29T11:00-04").
* Edge and Safari accept out-of-bounds time zone offsets (e.g., "2018-06-28T15:00-24:00").
* Chrome, Edge, Firefox, and Safari accept too few or too many fractional second digits (e.g., "2018-06-29T11:00:12.3456").

In short, developers can only trust `Date.parse` after themselves going through cumbersome and error-prone validation of input against the interchange format—which undermines the benefit of using `Date.parse` in the first place!

## Proposed Solution
Update `Date.parse` to check input against a format that encompasses both the current [Date Time String Format](https://tc39.github.io/ecma262/#sec-date-time-string-format) and small variations therefrom—especially those that are valid [ISO 8601 date and time representations](https://dotat.at/tmp/ISO_8601-2004_E.pdf) and standardize treatment of input conforming to it before falling back on implementation-defined behavior.

**NOTE**: Standard treatment includes both acceptance _and_ (where appropriate) rejection of input, as specified below.

### Background
I believe the interchange format is exactly described by the following regular expression (ignoring whitespace, which is only provided with the hope of improving readability):
```js
/^
  (?<year> [0-9]{4} | [+-][0-9]{6} )
  (
    -(?<month> 0[1-9] | 1[0-2] )
    (
      -(?<day>
        0[1-9] | 1[0-9] | 2[0-8] |
        (?<! ( [13579] | [02468][^048] | [13579][^26] )(00)?-02- ) 29 |
        (?<! 02- ) 30 |
        (?<! (02|04|06|09|11)- ) 31
      )
    )?
  )?
  (
    T(?<hour> [01][0-9] | 2[0-4] ):(?<minute> [0-5][0-9] )
    (
      :(?<second> [0-5][0-9] )
      (?<fraction> \.[0-9]{3} )?
    )?
    (?<! T24(:00)?:[0-9]*[1-9] | T24:00:00.[0-9]*[1-9] )
    (?<offset> Z | [+-] (?! 24 )( [01][0-9] | 2[0-4] ):( [0-5][0-9] ) )?
  )?
$/
```
Every current implementation I could find correctly interprets input matching this format (as would be expected) and a superset that includes fewer or more than three fractional digits (e.g., "2018-07-05T20:57:01.42Z"). However, there is _not_ uniform interpretation of edge cases whose nonconformance is limited to out-of-bounds fields (e.g., "2018-02-30" and "2018-06-28T24:01:01Z" and "2018-06-28T15:00-24:00").

### Changes
Specify the behavior of `Date.parse` not just for input conforming to the interchange format, but to a superset of it that encompasses both more of ISO 8601 and also invalid neighbors of valid input that may fail e.g. bounds checks or decimal localization or uppercase rules (and specifically those that that would be valid with different digits):
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

See the [draft spec](https://tc39.github.io/proposal-uniform-interchange-date-parsing/) for details.

### Other potential extensions (currently not recommended)
* Accept unsigned long years (e.g., "002018-07-03").
  * Such years are not valid in ISO 8601.
* Accept fractional minutes or hours (e.g., "2018-07-03T18:20.5Z").
  * Such values are valid in ISO 8601, but are something of an advanced feature.
* Specify uniform treatment for non-`Z` "military" character time zone offsets (e.g., "2018-07-03T14:20Q").
  * Such offsets are not valid in ISO 8601.
* Specify uniform treatment for four digit time zone offsets that don't have a colon (e.g., "2018-07-12T09:27-0400").
  * Such offsets appear in [RFC 5322](https://tools.ietf.org/html/rfc5322#section-3.3) and are valid in ISO 8601 _basic_ format representations, but the ECMAScript interchange format is otherwise a profile limited to _extended_ format. A case could be made for accepting them—[RFC 3339](https://tools.ietf.org/html/rfc3339#appendix-A) notes that "ISO 8601 is not clear if mixtures of basic and extended format are permissible."—but ISO 8601:2004(E) at least suggests that mixtures are not valid ([section 4.3.3](https://dotat.at/tmp/ISO_8601-2004_E.pdf#page=25) requires reduced precision date and time of day representations to "either be completely in basic format… or completely in extended format").
* Specify uniform treatment for any string that starts with four digits optionally preceded by a sign.
  * This would disallow implementations from accepting ISO 8601 ordinal dates (e.g., "2018-186") or week dates (e.g., "2018-W27-4"), not to mention ISO 8601 basic formats or input that does not conform to ISO 8601.

## Discussion
### Backwards Compatibility
This is by design an area of wide variance between implementations, but none of the proposed changes would require any input that is currently accepted by all of them to start being rejected.
Firefox already implements every proposed rejection, and many of the concessions.

### Exposing string conformance
Should ECMAScript expose a means of testing strings for conformance with the date-time interchange format?
Something like `Date.isPortableString` could be useful for validating input _before_ sending it to `Date.parse`, since that function retains the ability to accept strings that don't conform to the format.
It would also be nice to expose not just a Boolean classifier but the actual date-time fields (an enhancement similar to that offered by `RegExp.prototype.exec` over `RegExp.prototype.test`), but getting such an interface right at this point seems overly difficult, especially when considering time zone offsets (which dampen the possibility of just returning a [year, month, …] array for use with e.g. `new Date`).

### Related efforts
[proposal-date-time-string-format](https://github.com/tc39/proposal-date-time-string-format) by Morgan Phillips has a similar goal of standardizing `Date.parse` behavior over a broader range of input, but is focused on making more of it acceptable—including in particular strings that are not valid ISO 8601 representations, some of which use locale-specific characteristics such as the relative order of year, month, and day fields.
This proposal, in contrast, is focused on _rejecting_ input when it diverges from the interchange format through slight errors such as out-of-bounds values, improper designators or separators, and improper combinations of fields. Also unlike [proposal-date-time-string-format](https://github.com/tc39/proposal-date-time-string-format) and of particular importance is that every change proposed here is related to ISO 8601 calendar date-times, since that is the basis of the ECMAScript interchange format.
Essentially, this proposal aims to make parsing a limited subset of ISO 8601 calendar date-times the primary function of `Date.parse`, restricting implementation-specific behavior to other date-time formats.

[temporal](https://github.com/tc39/proposal-temporal) by @maggiepint, @mj1856, and @bterlson seeks to introduce _new_ types for working with dates and times, making it substantially larger than this proposal. Regardless of its progress, however, `Date` will remain part of ECMAScript and should be improved where possible. The inference of local vs. zero UTC offset from the presence vs. absence of time fields in a parsed ISO 8601 string can't be changed, but the parsing itself can be made more predictable as presented here.
