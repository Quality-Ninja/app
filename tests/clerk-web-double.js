// Served in place of Clerk's CDN scripts by the app tests, never by the application. It implements the part of Clerk
// the app uses (src/lib/clerk.ts).
(() => {
  // The API's test server (api/tests/browser_server.py) signs a real token for each test user.
  const api = 'http://127.0.0.1:8766';
  const listeners = new Set();
  const current = () => sessionStorage.getItem('test_clerk_user');
  function activate(id) {
    if (id) sessionStorage.setItem('test_clerk_user', id); else sessionStorage.removeItem('test_clerk_user');
    Clerk.user = id ? { id: 'user_' + id } : null;
    Clerk.session = id ? { id: 'sess_' + id, getToken: async ({ skipCache } = {}) => {
      window.tokenRequests = (window.tokenRequests || 0) + 1;
      // A test can make the next cached token stale, as if it had expired in the tab.
      if (window.staleTokenOnce && !skipCache) { window.staleTokenOnce = false; return 'stale-token'; }
      const { token } = await (await fetch(api + '/_test/session?user_id=' + id)).json();
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
  const unmount = node => node.replaceChildren();
  window.Clerk = {
    load: async options => { window.loadOptions = options; },
    addListener: listener => { listeners.add(listener); listener({ user: Clerk.user }); return () => listeners.delete(listener); },
    mountSignIn: mount('signIn'),
    unmountSignIn: unmount,
    mountSignUp: mount('signUp'),
    unmountSignUp: unmount,
    signOut: async ({ redirectUrl }) => { sessionStorage.removeItem('test_clerk_user'); location.assign(redirectUrl); },
    switchUser: activate
  };
  activate(current());
})();
