/* Comparison of AMIV API and CSV and interface to update membership. */

import m from 'mithril';

import { Card, Button } from 'polythene-mithril';

import { users as apiUsers } from './amivapi'; // List of objects
import { users as csvUsers } from './csv'; // List of nethz of users

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

    // Performance Optimizations: In previous versions, we used lists + filter
    // This caused horrible performance
    // We now use lots of maps to avoid unnecessary looping over lists
    const ok = [];
    const upgrade = [];
    const downgrade = [];
    const change = [];
    const missing = [];

    let userdata;
    const csvUserMap = {};
    csvUsers.list.forEach((nethz) => {
      csvUserMap[nethz] = true;
      userdata = apiUsers.userdata[nethz];
      if (userdata) {
        switch (userdata.membership) {
          case 'regular':
            ok.push(userdata); // ok.push(userdata);
            break;
          case 'none':
            upgrade.push(userdata);
            break;
          default: // Extraordinary or Honoray
            change.push(userdata);
        }
      } else {
        missing.push(nethz);
      }
    });

    apiUsers.list.forEach((user) => {
      if (!csvUserMap[user.nethz]) {
        if (user.membership === 'none') {
          ok.push(user);
        } else {
          downgrade.push(user);
        }
      }
    });

    // Workaround to get list of missing members locally
    // console.log(missing.join(' '));

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
