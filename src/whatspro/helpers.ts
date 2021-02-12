import urlRegex = require('url-regex-safe');
const normalizeUrl = require('normalize-url');

export const isAplhanumeric = c => {
  var x = c.charCodeAt();
  return (x >= 65 && x <= 90) || (x >= 97 && x <= 122) || (x >= 48 && x <= 57) ? true : false;
};

export const whatsappStyles = (format, wildcard, opTag, clTag) => {
  var indices = [];
  for (var i = 0; i < format.length; i++) {
    if (format[i] === wildcard) {
      if (indices.length % 2) {
        if (format[i - 1] === ' ' || format[i - 1] === wildcard) {
        } else if (typeof format[i + 1] === 'undefined') {
          indices.push(i);
        } else if (isAplhanumeric(format[i + 1])) {
        } else indices.push(i);
      } else if (typeof format[i + 1] === 'undefined') {
      } else if (format[i + 1] === ' ') {
      } else if (typeof format[i - 1] === 'undefined') {
        indices.push(i);
      } else if (isAplhanumeric(format[i - 1])) {
      } else indices.push(i);
    } else {
      if (format[i].charCodeAt() === 10 && indices.length % 2) indices.pop();
    }
  }

  if (indices.length % 2) indices.pop();

  var e = 0;

  indices.forEach(function(v, i) {
    var t = i % 2 ? clTag : opTag;
    v += e;
    format = format.substr(0, v) + t + format.substr(v + 1);
    e += t.length - 1;
  });
  return format;
};

export const convertWAToHtml = (message: string) => {
  if (!message) return message;

  message = whatsappStyles(message, '_', '<i>', '</i>');
  message = whatsappStyles(message, '*', '<b>', '</b>');
  message = whatsappStyles(message, '~', '<s>', '</s>');
  message = message.replace(/\n/gi, '<br/>');

  const urls = message.match(urlRegex({ strict: false, auth: true })) || [];

  urls.forEach(url => {
    if (
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(
        url,
      )
    ) {
      message = message.replace(url, `<a href='mailto:${url}'>${url}</a>`);
    } else {
      message = message.replace(url, `<a href='${normalizeUrl(url)}' target='_blank'>${url}</a>`);
    }
  });

  return message;
};
