/*
 * Copyright 2015 Mirantis, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 **/

import registerSuite from 'intern!object';
import Common from 'tests/functional/pages/common';
import ClusterPage from 'tests/functional/pages/cluster';

registerSuite(() => {
  var common,
    clusterPage,
    clusterName;

  return {
    name: 'Logs Tab',
    setup() {
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      clusterName = common.pickRandomName('Test Cluster');

      return this.remote
        .then(() => common.getIn())
        .then(() => common.createCluster(clusterName))
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .then(() => clusterPage.goToTab('Logs'));
    },
    '"Show" button availability and logs displaying'() {
      var showLogsButtonSelector = '.sticker button';
      return this.remote
        .assertElementsExist('.sticker select[name=source] > option',
          'Check if "Source" dropdown exist')
        .assertElementDisabled(showLogsButtonSelector,
          '"Show" button is disabled until source change')
        // Change the selected value for the "Source" dropdown to Rest API
        .clickByCssSelector('.sticker select[name=source] option[value=api]')
        // Change the selected value for the "Level" dropdown to DEBUG
        .clickByCssSelector('.sticker select[name=level] option[value=DEBUG]')
        .assertElementEnabled(showLogsButtonSelector,
          '"Show" button is enabled after source change')
        .execute(() => {
          window.server = sinon.fakeServer.create();
          window.server.autoRespond = true;
          window.server.autoRespondAfter = 1000;
          window.server.respondWith(/\/api\/logs\/.*/, [
            200, {'Content-Type': 'application/json'},
            JSON.stringify({
              from: 1,
              entries: [['Date', 'INFO', 'Test Log Entry']]
            })
          ]);
        })
        .clickByCssSelector(showLogsButtonSelector)
        .assertElementDisappears('.logs-tab div.progress', 5000,
          'Wait till Progress bar disappears')
        .assertElementsAppear('.log-entries > tbody > tr', 5000, 'Log entries are shown')
        .execute(() => {
          window.server.restore();
        })
        // "Other servers" option is present in "Logs" dropdown
        .clickByCssSelector('.sticker select[name=type] > option[value=remote]')
        .assertElementExists('.sticker select[name=node] > option', '"Node" dropdown is present');
    }
  };
});
