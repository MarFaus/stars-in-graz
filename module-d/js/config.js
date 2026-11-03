/*
  Address of the Module C API.
  Served over http(s) next to module-c (http://competitor-N/module-d and
  http://competitor-N/module-c) the real API is used. Opened straight from the
  file system there is no server, so the built-in demo API takes over.
  Set apiUrl to a full address to point the app at any other API.
*/
window.APP_CONFIG = {
  apiUrl: /^https?:$/.test(location.protocol) ? '../module-c/api/v1' : ''
};
