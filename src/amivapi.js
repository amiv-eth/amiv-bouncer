/* Session and Users from AMIVAPI */

// Big Todo: Simplify the user requesting, its horribly convoluted!

import m from 'mithril';
import ls from 'local-storage';
import { Button } from 'polythene-mithril';
import { apiUrl, OAuthId } from 'config';

// Persist token and state for oauth-request
let session = ls.get('session') || {};
ls.on('session', (newSession) => { session = newSession; m.redraw(); });

// Redirect to OAuth landing page
function login() {
  // Generate random state and overwrite currently stored session data
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

  // Redirect
  window.location.href = `${apiUrl}/oauth?${query}`;
}

function logout() {
  session = {};
  ls.set('session', session);
  m.redraw();
}


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
  logout();
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

  // All users indexed by (unique nethz)
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
      headers: { Authorization: session.token },
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
      headers: { Authorization: session.token },
    }).then(r => this.processResponse(r));
  },

  /* Helper to process response: add all users to interal table */
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
  setMembership(userList, membership) {
    if (this.busy) { throw new RequestError(); }

    apiMessage = `Set membership of ${userList.length} to '${membership}...'`;
    const promiseList = userList.map(({ nethz }) => {
      const { _id: id, _etag: etag } = this.userdata[nethz];
      return m.request({
        method: 'PATCH',
        url: `${apiUrl}/users/${id}`,
        headers: { Authorization: session.token, 'If-Match': etag },
        data: { membership },
      }).then((updates) => { this.userdata[nethz] = updates; });
    });
    this.trackProgress(promiseList);
  },
};


// Check Token in URL to determine login status

function validateToken() {
  const query = m.buildQueryString({
    where: JSON.stringify({ token: session.token }),
  });
  m.request({
    method: 'GET',
    headers: { Authorization: session.token },
    url: `${apiUrl}/sessions?${query}`,
  }).then((data) => {
    if (data._items.length !== 0) {
      // Validate token
      session.validated = true;
      ls.set('session', session);
    } else {
      // Token not valid anymore
      logout();
    }
  });
}


// Check if user was sent back (token with correct state in URL)
function checkToken() {
  const query = m.parseQueryString(window.location.search);

  if (query.state && query.access_token && (query.state === session.state)) {
    // Safe token
    session.token = query.access_token;
    session.validated = false;
    ls.set('session', session);

    validateToken();
  }
}

checkToken();

export function loggedIn() {
  return session.token && session.validated;
}


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
      events: { onclick: logout },
    }));
  },
};

// Export API View
export const apiView = {
  view() {
    return loggedIn() ? [
      m(statusView), m(logoutView),
    ] : [];
  },
};

export const helloView = {
  view() {
    let message;
    if (!session.token) {
      message = 'Welcome to the AMIV Bouncer, who takes a look at the ' +
                'list of members and decides who is in and who is not. ' +
                'Please click anywhere to log in.';
    } else if (!session.validated) {
      message = 'Welcome back, please wait a moment while your permissions ' +
                'are verified.';
    }

    return m('.file-upload', { onclick: login }, message);
  },
};
