/* Comparison of AMIV API and CSV and interface to update membership. */

import m from 'mithril';

import { Card, Button } from 'polythene-mithril';

import { users as apiUsers } from './amivapi'; // List of objects
import { users as csvUsers } from './csv'; // List of nethz of users

function inCSV(apiUser) {
  return csvUsers.list.indexOf(apiUser.nethz) !== -1;
}
function inAPI(nethz) {
  return apiUsers.list.filter(user => user.nethz === nethz).length !== 0;
}
function checkMembership(user, membership) {
  return user.membership === membership;
}
function noMember(user) { return checkMembership(user, 'none'); }
function regularMember(user) { return checkMembership(user, 'regular'); }
function specialMember(user) {
  return checkMembership(user, 'extraordinary') ||
         checkMembership(user, 'honorary');
}

const listView = {
  view({
    attrs: {
      title,
      subtitle,
      list,
      actionName,
      action,
    },
  }) {
    return m(
      '.comparison-entry',
      m(Card, {
        content: [
          {
            header: { title, subtitle },
          },
          {
            text: { content: `${list.length} matches.` },
          },
          {
            actions: {
              content: m(Button, {
                label: actionName,
                inactive: apiUsers.busy || !action,
                events: { onclick() { action(list); } },
              }),
            },
          },
        ],
      }),
    );
  },
};

export default {
  view() {
    if (apiUsers.list.length === 0) {
      return m('.comparison-empty', 'No users in API.');
    }
    if (csvUsers.list.length === 0) {
      return m('.comparison-empty', 'No users in file.');
    }

    // All relevant combinations
    const ok = apiUsers.list.filter(user =>
      ((regularMember(user) && inCSV(user)) ||
       (!regularMember(user) && !inCSV(user))));

    const upgrade = apiUsers.list.filter(user =>
      noMember(user) && inCSV(user));
    const downgrade = apiUsers.list.filter(user =>
      regularMember(user) && !inCSV(user));
    const change = apiUsers.list.filter(user =>
      specialMember(user) && inCSV(user));
    const missing = csvUsers.list.filter(user => !inAPI(user));

    return [
      m(listView, {
        title: 'All good!',
        subtitle: 'API and CSV match.',
        list: ok,
        actionName: 'No action needed',
      }),
      m(listView, {
        title: 'Upgrade',
        subtitle: 'Membership in CSV, but not in API.',
        list: upgrade,
        actionName: 'Upgrade membership',
        action(userList) { apiUsers.setMembership(userList, 'regular'); },
      }),
      m(listView, {
        title: 'Downgrade',
        subtitle: 'Membership in API, but not in CSV.',
        list: downgrade,
        actionName: 'Downgrade membership',
        action(userList) { apiUsers.setMembership(userList, 'none'); },
      }),
      m(listView, {
        title: 'Change',
        subtitle: 'Special Membership in API, normal in CSV.',
        list: change,
        actionName: 'Make Regular',
        action(userList) { apiUsers.setMembership(userList, 'regular'); },
      }),
      m(listView, {
        title: 'Missing',
        subtitle: 'Not found in API.',
        list: missing,
        actionName: 'No action possible',
        // Currently not supported
        // action(nethzList) { apiUsers.sync(nethzList); },
      }),
    ];
  },
};
