const params = new URLSearchParams(location.search);

if (params.has('demo') || location.pathname.replace(/\/+$/, '') === '/demo') {
  void import('./demo/main');
} else {
  void import('./controller/main');
}
