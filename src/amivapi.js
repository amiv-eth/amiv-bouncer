/* Session and Users from AMIVAPI */

// Todo: Wrapper for multi-request

import m from 'mithril';
import { Button, TextField } from 'polythene-mithril';

const apiUrl = 'https://amiv-api-gv-1.ethz.ch';

let token = '';
let tokenIsValid = false;
// let apiMessage = '';
let userCount = 0;

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
  token = '';
  const formattedCode = err.code ? ` (${err.code})` : '';
  // apiMessage = `Error${formattedCode}: ${err.message}`;
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
  get busy() { return this.totalRequests !== this.completedRequests; },

  get list() { return Object.values(this.userdata); },

  userdata: {},

  /* Get ALL users in amivapi. Really, all of them. */
  get() {
    if (this.busy) { throw new RequestError(); }
    // Reset Data
    this.userdata = {};
    this.totalRequests = 0;
    this.completedRequests = 0;

    // Use first request to discover number of pages and check permissions
    return m.request({
      method: 'GET',
      url: `${apiUrl}/users?${proj}`,
      headers: { Authorization: token },
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
        return response;
      })
      // 2. Start requests for all other pages
      .then((response) => {
        userCount = response._meta.total;
        const pageSize = response._meta.max_results;
        const pages = Math.ceil(userCount / pageSize);

        // Initialize Progress Counter
        this.completedRequests = 0;
        this.totalRequests = pages - 1;

        for (let p = 2; p <= pages; p += 1) { this.getPage(p); }
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
      headers: { Authorization: token },
    }).then(r => this.processResponse(r))
      .then(() => { this.completedRequests += 1; })
      .catch(handleApiError);
  },

  /* Helper to process response: add all users to interal table */
  processResponse(response) {
    response._items.forEach((user) => { this.userdata[user._id] = user; });
    return response;
  },

  /* Try to synchronize user with LDAP (triggered by login attempt) */
  sync(nethzList) {
    if (nethzList.length) {
      if (this.busy) { throw new RequestError(); }

      // Init Progress
      this.totalRequests = nethzList.length;
      this.completedRequests = 0;

      nethzList.forEach(nethz =>
        m.request({
          method: 'POST',
          url: `${apiUrl}/sessions`,
          data: { username: nethz, password: '' },
        }).then(() => { this.completedRequests += 1; }));
      // Todo: Get updated users
    }
    return Promise.resolve(); // Nothing to do
  },

  /* Change membership of user to new value */
  setMembership(userList, membership) {
    if (userList.length) {
      if (this.busy) { throw new RequestError(); }

      // Init Progress
      this.totalRequests = userList.length;
      this.completedRequests = 0;

      userList.forEach((user) => {
        const id = user._id;
        const etag = this.userdata[id]._etag;
        return m.request({
          method: 'PATCH',
          url: `${apiUrl}/users/${id}`,
          headers: { Authorization: token, 'If-Match': etag },
          data: { membership },
        }).then((updates) => { this.userdata[id] = updates; })
          .then(() => { this.completedRequests += 1; });
      });
    }
    return Promise.resolve(); // Nothing to do
  },
};

// Auth Interface
export const auth = {
  username: '',
  password: '',

  get loggedIn() { return (Boolean(token) && tokenIsValid); },

  get canLogin() { return this.password !== ''; },

  /* Login. If only password provided, try to use it as token */
  login() {
    // apiMessage = ''; // Reset errors
    if (this.username !== '') {
      m.request({
        method: 'POST',
        url: `${apiUrl}/sessions`,
        data: { username: this.username, password: this.password },
      }).then(({ token: t }) => { token = t; this.startGet(); })
        .catch(handleApiError);
    } else {
      token = this.password;
      this.startGet();
    }
  },

  logout() {
    token = '';
    // apiMessage = 'Goodbye!';
  },

  /* Init download, if first request succeeds assume token is valid */
  startGet() {
    users.get().then(() => { tokenIsValid = true; });
  },
};

// Export API View
export const apiView = {
  view() {
    const progress = Math.round(users.progress * 100);
    return m('.header-api', [
      m(
        '.header-api-bar-container',
        m('.header-api-bar', { style: `width: ${progress}%` }, ''),
      ),
      m('.header-api-text', `${users.list.length} users loaded from API`),
    ]);
  },
};

export const loginView = {
  view() {
    return [
      m(TextField, {
        label: 'nethz',
        floatingLabel: true,
        value: auth.username,
        onChange: (newState) => { auth.username = newState.value; },
      }),
      m(TextField, {
        label: 'password or token',
        type: 'password',
        floatingLabel: true,
        value: auth.password,
        onChange: (newState) => { auth.password = newState.value; },
      }),
      m('.header-logout', m(Button, {
        label: 'Login',
        events: { onclick() { auth.login(); } },
      })),
    ];
  },
};

export const logoutView = {
  view() {
    return m('.header-logout', m(Button, {
      label: 'Logout',
      tone: 'dark',
      events: { onclick() { auth.logout(); } },
    }));
  },
};
