// Served in place of Clerk's CDN scripts by the app tests, never by the application.
(() => {
  const listeners = [];
  const current = () => sessionStorage.getItem('test_clerk_user');
  function activate(id) {
    if (id) sessionStorage.setItem('test_clerk_user', id); else sessionStorage.removeItem('test_clerk_user');
    Clerk.user = id ? { id: 'user_' + id } : null;
    Clerk.session = id ? { id: 'sess_' + id, getToken: async ({ skipCache } = {}) => {
      window.tokenRequests = (window.tokenRequests || 0) + 1;
      // A test can make the next cached token stale, as if it had expired in the tab.
      if (window.staleTokenOnce && !skipCache) { window.staleTokenOnce = false; return 'stale-token'; }
      // The API's test server signs a real token for this user (see api/tests/browser_server.py).
      const { token } = await (await fetch(window.QaNinjaConfig.apiBaseUrl + '/_test/session?user_id=' + id)).json();
      return token;
    }} : null;
    listeners.forEach(listener => listener({ user: Clerk.user }));
  }
  // Both views render the same test buttons; tests read the load options and the last mount to check the wiring.
  const mount = kind => (node, options) => {
    window.lastMount = { kind, options };
    for (const [id, label] of [['email-code', 'Use email code'], ['google', 'Continue with Google']]) {
      const button = Object.assign(document.createElement('button'), { id, textContent: label });
      button.onclick = () => { activate('1'); location.assign(options.forceRedirectUrl); };
      node.append(button);
    }
  };
  window.Clerk = {
    load: async options => { window.loadOptions = options; },
    addListener: listener => { listeners.push(listener); listener({ user: Clerk.user }); },
    mountSignIn: mount('signIn'),
    mountSignUp: mount('signUp'),
    signOut: async ({ redirectUrl }) => { sessionStorage.removeItem('test_clerk_user'); location.assign(redirectUrl); },
    switchUser: activate
  };
  activate(current());
})();
