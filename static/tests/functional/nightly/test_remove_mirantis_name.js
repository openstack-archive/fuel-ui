/*
 * Copyright 2016 Mirantis, Inc.
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
import GenericLib from 'tests/functional/nightly/library/generic';

registerSuite(() => {
  var common,
    clusterPage,
    genericLib,
    clusterName;
  return {
    name: 'Remove Mirantis name from Fuel UI',
    setup() {
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      genericLib = new GenericLib(this.remote);
      clusterName = common.pickRandomName('Test Cluster');

      return this.remote
        .then(() => common.getIn())
        .then(() => common.createCluster(clusterName))
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .then(() => common.addNodesToCluster(1, ['Compute']))
        .then(() => clusterPage.goToTab('Dashboard'));
    },
    'Check that name removed from header logo and bottom "copyright" on generic pages'() {
      return this.remote
        .then(() => genericLib.checkMirantisRefsOnPage('Environments'))
        .then(() => genericLib.checkMirantisRefsOnPage('Equipment'))
        .then(() => genericLib.checkMirantisRefsOnPage('Releases'))
        .then(() => genericLib.checkMirantisRefsOnPage('Plugins'))
        .then(() => genericLib.checkMirantisRefsOnPage('Support'))
        .assertElementNotExists('.account-connect')
        .assertElementNotExists('.contact-support')
        .assertElementNotContainsText('support-box-content h3', 'irantis',
          '"Fuel Documentation" pane not contains Mirantis names')
        .assertElementNotContainsText('support-box-content h3 p', 'irantis',
          '"Fuel Documentation" pane not contains Mirantis names')
        .assertElementNotContainsText('.statistics-text-box div', 'irantis OpenStack',
          '"Send Statistics About Usage" block not contains Mirantis names')
        .assertElementNotContainsText('.checkbox-group label', 'irantis',
          '"Send usage statistic" check-box not contains Mirantis names');
    },
    'Check that name removed from header logo and bottom "copyright" on cluster tabs'() {
      return this.remote
        .then(() => genericLib.gotoPage('Environments'))
        .clickByCssSelector('.clusterbox[href="#cluster/1"]')
        .waitForCssSelector('.cluster-page .tabs', 500)
        .then(() => genericLib.checkMirantisRefsOnTab('Dashboard'))
        .then(() => genericLib.checkMirantisRefsOnTab('Nodes'))
        .then(() => genericLib.checkMirantisRefsOnTab('Networks'))
        .then(() => genericLib.checkMirantisRefsOnTab('Settings'))
        .then(() => genericLib.checkMirantisRefsOnTab('Logs'))
        .then(() => genericLib.checkMirantisRefsOnTab('Health Check'));
    }
  };
});
