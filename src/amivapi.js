/* Session and Users from AMIVAPI */

import m from 'mithril';
import ls from 'local-storage';
import { Button } from 'polythene-mithril';
import { apiUrl, OAuthId } from 'config';


// AMIVAPI OAUTH
// =============

// Persist token and state for oauth-request
let session = ls.get('session') || {};
ls.on('session', (newSession) => { session = newSession; m.redraw(); });

export function getToken() {
  return session.token;
}

// Redirect to OAuth landing page
export function login() {
  // Generate random state and reset currently stored session data
  const newSession = {
    state: Math.random().toString(),
  };
  ls.set('session', newSession);

  const query = m.buildQueryString({
    response_type: 'token',
    client_id: OAuthId,
    redirect_uri: window.location.origin,
    state: newSession.state,
  });

  // Redirect to AMIV api oauth page
  window.location.href = `${apiUrl}/oauth?${query}`;
}

let logoutMessage = '';
export function getLogoutMessage() { return logoutMessage; }

export function logout(message = '') {
  session = {};
  ls.set('session', session);
  logoutMessage = message;
}


// Extract token from query string automatically if state matches
const params = m.parseQueryString(window.location.search);
if (params.state && params.access_token && (params.state === session.state)) {
  session.token = params.access_token;
  ls.set('session', session);
}


// AMIVAPI REQUESTS
// ================

let apiMessage = '';

/* Error if too many requests are attempted. */
function RequestError() {
  this.name = 'RequestError';
  this.message = 'Cannot send new requests, other requests are in progress!';
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

  async trackProgress(promiseList) {
    // Init progress
    this.totalRequests = promiseList.length;
    this.completedRequests = 0;

    // Update progress with each resolved promise
    promiseList.forEach((promise) => {
      promise.then(() => { this.completedRequests += 1; });
    });

    // Wait for all other promises to resolve
    try {
      await Promise.all(promiseList);
      apiMessage = `${this.list.length} users synchronized with API.`;
    } catch (err) {
      apiMessage = 'Some requests were unsuccessful, please reload page!';
    }
  },

  get busy() { return this.totalRequests !== this.completedRequests; },

  get list() { return Object.values(this.userdata); },

  // All users indexed by (unique nethz)
  userdata: {},

  /* Get ALL users in amivapi. Really, all of them. */
  async get() {
    if (this.busy) { throw new RequestError(); }
    // Reset Data
    this.userdata = {};

    // 1. Use first request to discover number of pages and check permissions
    const initialRequest = m.request({
      method: 'GET',
      url: `${apiUrl}/users?${proj}`,
      headers: { Authorization: session.token },
    });
    const response = await initialRequest;

    if (response._items.length === 0) {
      apiMessage = 'No users in API!';
      return;
    }
    // Check if patch possible. Randomly, we could get own user back
    // so check patch for everyone in first response to be sure
    function cannotPatch(user) {
      const { _links: { self: { methods } } } = user;
      return methods.indexOf('PATCH') === -1;
    }
    if (response._items.some(cannotPatch)) {
      logout('You have been logged out because your permissions are ' +
               'insufficient. You must be able to modify all users to ' +
               'use this tool.');
    }

    // 2. Process users in first response
    this.processResponse(response);

    // 3. Start requests for all other pages
    const { total: userCount, max_results: pageSize } = response._meta;
    const pages = Math.ceil(userCount / pageSize);

    apiMessage = 'Requesting all users from API...';
    const promiseList = [initialRequest];
    for (let p = 2; p <= pages; p += 1) {
      promiseList.push(this.getPage(p));
    }
    await this.trackProgress(promiseList);
  },

  /* Get users on a specific page */
  async getPage(page) {
    const data = await m.request({
      method: 'GET',
      url: `${apiUrl}/users?${proj}&page=${page}`,
      headers: { Authorization: session.token },
    });

    this.processResponse(data);

    return data;
  },

  /* Helper to process response: add all users to internal table */
  processResponse(response) {
    response._items.forEach((user) => { this.userdata[user.nethz] = user; });
    return response;
  },

  /* Try to synchronize user with LDAP (triggered by login attempt)
  // -> This does not work! API only imports on successful login
  sync(nethzList) {
    if (this.busy) { throw new RequestError(); }

    apiMessage =
      `Prompt API to synchronize ${nethzList.length} users with LDAP...'`;
    const promiseList = nethzList.map(nethz =>
      m.request({
        method: 'POST',
        url: `${apiUrl}/sessions`,
        data: { username: nethz, password: '' },
      }).catch(() => { }));
    this.trackProgress(promiseList)
      .then(() => { this.get();  });
  },
  */

  /* Change membership of user to new value */
  async setMembership(userList, membership) {
    if (this.busy) { throw new RequestError(); }

    apiMessage = `Setting membership of ${userList.length} ` +
                 `users to '${membership}...'`;
    const promiseList = userList.map(({ nethz }) => {
      const { _id: id, _etag: etag } = this.userdata[nethz];
      return m.request({
        method: 'PATCH',
        url: `${apiUrl}/users/${id}`,
        headers: { Authorization: session.token, 'If-Match': etag },
        data: { membership },
      }).then((updates) => { this.userdata[nethz] = updates; });
    });

    await this.trackProgress(promiseList);
  },
};


// Export API View
const statusView = {
  oninit() { users.get(); },
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


const logoutView = {
  view() {
    return m('.header-api-logout', m(Button, {
      label: 'Logout',
      tone: 'dark',
      events: { onclick() { logout('You have been logged out. Goodbye!'); } },
    }));
  },
};

// Export API View
export const apiView = {
  view() {
    return [
      m(statusView), m(logoutView),
    ];
  },
};
