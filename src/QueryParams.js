import {assert} from 'assert';

/**
 * Serialize the parameters into a queryString, not including the leading "?" or
 * "&".
 */
function toQueryString (params:Map) {
  var queryString = '',
      i = 0,
      orderedKeys, key, encodedKey, value;

  for (key of params.keys()) {
    encodedKey = encodeValue(key);
    queryString += encodedKey;
    queryString += '=';
    value = params.get(key);
    queryString += encodeValue(value, encodedKey);
    queryString += ++i < params.size ? '&' : '';
  }

  return queryString;
}

function encodeValue (value, encodedKey) {
  var iVal, i, queryString = '';
  if (Array.isArray(value)) {
    if (!encodedKey) {
      throw new Error('Missing 2nd argument: "encodedKey"');
    }

    for (i = 0; i < value.length; i++) {
      iVal = value[i];
      queryString += encodeValue(iVal);
      if (i + 1 < value.length) queryString += '&' + encodedKey + '=';
    }

    return queryString;
  }
  else {
    switch (typeof value) {
      case 'object':
        value = JSON.stringify(value);
        break;
      default:
        value = value.toString();
    }
  }

  return window.encodeURIComponent(value).
          replace('%3A', ':').
          replace('%20', '+').
          replace('%24', '$').
          replace('%40', '@');
}

export {encodeValue, toQueryString}
