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
Define a format that encompasses both the [Date Time String Format](https://tc39.github.io/ecma262/#sec-date-time-string-format) and small variations therefrom—especially those that are valid ISO 8601—and standardize `Date.parse` treatment of input conforming to it.

## Discussion
### Backwards Compatibility
This is by design an area of wide variance between implementations, but none of the proposed changes would require any input that is currently accepted by all of them to start being rejected.
