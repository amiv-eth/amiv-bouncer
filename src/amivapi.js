/* Session and Users from AMIVAPI */

import m from 'mithril';
import { Button, TextField } from 'polythene-mithril';

const apiUrl = 'https://amiv-api-gv-1.ethz.ch';

const tokenStorage = {
  token: window.localStorage.getItem('bouncer-token'),
  isValid: window.localStorage.getItem('bouncer-valid'),

  setToken(token) {
    this.token = token;
    window.localStorage.setItem('bouncer-token', token);
  },
  setValid() {
    this.isValid = true;
    window.localStorage.setItem('bouncer-valid', 'valid');
  },
  setInvalid() {
    this.setToken(''); // Additionally reset token
    this.isValid = false;
    window.localStorage.setItem('bouncer-valid', '');
  },
};

let apiMessage = '';

/* Error if too many requests are attempted. */
function RequestError() {
  this.name = 'RequestError';
  this.message = 'Cannot send new requests, other requests are in progress!';
}

/* Error in Eve format for easier parsing */
function ApiError(message) {
  this._error = {
    code: '',
    message,
  };
}
/* Generic Error Handler */
function handleApiError({ _error: err }) {
  // Log out and show error
  tokenStorage.setInvalid();
  const formattedCode = err.code ? ` (${err.code})` : '';
  apiMessage = `Error${formattedCode}: ${err.message}`;
}

/* Projection to only include required fields for users. */
const proj = m.buildQueryString({
  projection: JSON.stringify({
    firstname: 1, lastname: 1, membership: 1, nethz: 1,
  }),
});

// User Interface
export const users = {
  // Request progress helpers
  totalRequests: 0,
  completedRequests: 0,
  get progress() {
    return this.totalRequests ? (this.completedRequests / this.totalRequests)
      : 0;
  },

  trackProgress(promiseList) {
    // Init progress
    this.totalRequests = promiseList.length;
    this.completedRequests = 0;

    // Update progress with each resolve
    promiseList.forEach((promise) => {
      promise.then(() => { this.completedRequests += 1; });
    });

    // Return Promise that resolves if all resolve
    return Promise.all(promiseList)
      .then(() => {
        apiMessage = `${this.list.length} users synchronized with API.`;
      })
      .catch(() => {
        apiMessage = 'Some requests were unsuccessful, please reload page!';
      });
  },

  get busy() { return this.totalRequests !== this.completedRequests; },

  get list() { return Object.values(this.userdata); },

  userdata: {},

  /* Get ALL users in amivapi. Really, all of them. */
  get() {
    if (this.busy) { throw new RequestError(); }
    // Reset Data
    this.userdata = {};

    // Use first request to discover number of pages and check permissions
    return m.request({
      method: 'GET',
      url: `${apiUrl}/users?${proj}`,
      headers: { Authorization: tokenStorage.token },
    })
      // 1. Users exist and token grants permissions
      .then((response) => {
        if (response._items.length === 0) {
          throw new ApiError('No users in API!');
        }
        // Check if patch possible. Randomly, we could get own user back
        // so check patch for everyone in first response to be sure
        response._items.forEach(({ _links: { self: { methods } } }) => {
          if (methods.indexOf('PATCH') === -1) {
            throw new ApiError('Insufficient permissions, ' +
                               'user patching is required!');
          }
        });
        tokenStorage.setValid();
        return response;
      })
      // 2. Start requests for all other pages
      .then((response) => {
        const userCount = response._meta.total;
        const pageSize = response._meta.max_results;
        const pages = Math.ceil(userCount / pageSize);

        apiMessage = 'Requesting all users from API...';
        const promiseList = [];
        for (let p = 2; p <= pages; p += 1) {
          promiseList.push(this.getPage(p));
        }
        this.trackProgress(promiseList);
        return response;
      })
      // 3. Process users in first response
      .then(r => this.processResponse(r))
      // 5. Catch all API errors
      .catch(handleApiError);
  },

  /* Get users on a specific page */
  getPage(page) {
    return m.request({
      method: 'GET',
      url: `${apiUrl}/users?${proj}&page=${page}`,
      headers: { Authorization: tokenStorage.token },
    }).then(r => this.processResponse(r));
  },

  /* Helper to process response: add all users to interal table */
  processResponse(response) {
    response._items.forEach((user) => { this.userdata[user._id] = user; });
    return response;
  },

  /* Try to synchronize user with LDAP (triggered by login attempt) */
  sync(nethzList) {
    if (this.busy) { throw new RequestError(); }

    apiMessage =
      `Prompt API to synchronize ${this.list.length} users with LDAP...'`;
    const promiseList = nethzList.map(nethz =>
      m.request({
        method: 'POST',
        url: `${apiUrl}/sessions`,
        data: { username: nethz, password: '' },
      }).catch(() => { /* We expect failure, do nothing! */ }));
    this.trackProgress(promiseList)
      .then(() => { this.get(); /* Refresh users */ });
  },

  /* Change membership of user to new value */
  setMembership(userList, membership) {
    if (this.busy) { throw new RequestError(); }

    apiMessage = `Set membership of ${userList.length} to '${membership}...'`;
    const promiseList = userList.map((user) => {
      const id = user._id;
      const etag = this.userdata[id]._etag;
      return m.request({
        method: 'PATCH',
        url: `${apiUrl}/users/${id}`,
        headers: { Authorization: tokenStorage.token, 'If-Match': etag },
        data: { membership },
      }).then((updates) => { this.userdata[id] = updates; });
    });
    this.trackProgress(promiseList);
  },
};

// Auth Interface
export const auth = {
  username: '',
  password: '',

  get loggedIn() { return tokenStorage.isValid; },

  get canLogin() { return this.password !== ''; },

  /* Login. If only password provided, try to use it as token */
  login() {
    apiMessage = ''; // Reset errors
    tokenStorage.setInvalid();
    if (this.username !== '') {
      m.request({
        method: 'POST',
        url: `${apiUrl}/sessions`,
        data: { username: this.username, password: this.password },
      }).then(({ token: t }) => { tokenStorage.setToken(t); this.startGet(); })
        .catch(handleApiError);
    } else {
      tokenStorage.setToken(this.password);
      this.startGet();
    }
  },

  logout() {
    tokenStorage.setInvalid();
    apiMessage = 'Goodbye!';
  },

  /* Init download, if first request succeeds assume token is valid */
  startGet() { users.get(); },
};

// If a token is already in storage, immediately get
if (auth.loggedIn) { users.get(); }


// Export API View
const statusView = {
  view() {
    const progress = Math.round(users.progress * 100);
    return m('.header-api-status', [
      m(
        '.header-api-bar-container',
        m('.header-api-bar', { style: `width: ${progress}%` }, ''),
      ),
      m('.header-api-text', apiMessage),
    ]);
  },
};

const loginView = {
  view() {
    return m('.header-api-login', [
      m(TextField, {
        label: 'nethz',
        floatingLabel: true,
        tone: 'dark',
        value: auth.username,
        onChange: (newState) => { auth.username = newState.value; },
      }),
      m(TextField, {
        label: 'password or token',
        type: 'password',
        floatingLabel: true,
        tone: 'dark',
        value: auth.password,
        onChange: (newState) => { auth.password = newState.value; },
      }),
      // m('div', apiMessage), // TODO: Report Errors
      m(Button, {
        label: 'Login',
        tone: 'dark',
        events: { onclick() { auth.login(); } },
      }),
    ]);
  },
};

const logoutView = {
  view() {
    return m('.header-api-logout', m(Button, {
      label: 'Logout',
      tone: 'dark',
      events: { onclick() { auth.logout(); } },
    }));
  },
};

// Export API View
export const apiView = {
  view() {
    return auth.loggedIn ? [
      m(statusView), m(logoutView),
    ] : [
      m(loginView),
    ];
  },
};
