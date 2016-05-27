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
import ClustersPage from 'tests/functional/pages/clusters';
import GenericLib from 'tests/functional/nightly/library/generic';

registerSuite(() => {
  var common,
    clustersPage,
    genericLib,
    clusterName;
  return {
    name: 'Remove Mirantis name from Fuel UI',
    setup() {
      common = new Common(this.remote);
      clustersPage = new ClustersPage(this.remote);
      genericLib = new GenericLib(this.remote);
      clusterName = common.pickRandomName('Test Cluster');

      return this.remote
        .then(() => common.getIn())
        .then(() => common.createCluster(clusterName));
    },
    'Check that "Mirantis" names and reference are removed from generic pages'() {
      var mirantisRegExp = RegExp('Mirantis', 'i');
      return this.remote
        .then(() => genericLib.checkMirantisRefsOnPage('Environments'))
        .then(() => genericLib.checkMirantisRefsOnPage('Equipment'))
        .then(() => genericLib.checkMirantisRefsOnPage('Releases'))
        .then(() => genericLib.checkMirantisRefsOnPage('Plugins'))
        .then(() => genericLib.checkMirantisRefsOnPage('Support'))
        .assertElementNotExists('.account-connect',
          '"Connect Mirantis Account" pane not exists on "Support" page')
        .assertElementNotExists('.contact-support',
          '"Contact Support" pane not exists on "Support" page')
        .assertElementNotMatchesRegExp('.content-box > :nth-child(1) p', mirantisRegExp,
          '"Fuel Documentation" panes text not contains Mirantis names')
        .assertElementNotMatchesRegExp('.content-box > :nth-child(1) h3', mirantisRegExp,
          '"Fuel Documentation" panes header not contains Mirantis names')
        .assertElementNotMatchesRegExp('.content-box > :nth-child(7) h3',
          RegExp('Mirantis OpenStack', 'i'),
          '"Send Statistics About Usage" panes header not contains Mirantis names')
        .assertElementNotMatchesRegExp('.statistics-text-box div',
          RegExp('Mirantis OpenStack', 'i'),
          '"Send Statistics About Usage" panes text not contains Mirantis names')
        .assertElementNotMatchesRegExp('.checkbox-group label', mirantisRegExp,
          '"Send usage statistic" check-box not contains Mirantis names');
    },
    'Check that name removed from header logo and bottom "copyright" cluster tabs'() {
      return this.remote
        .then(() => genericLib.gotoPage('Environments'))
        .then(() => clustersPage.goToEnvironment('Test Cluster #1'))
        .then(() => genericLib.checkMirantisRefsOnTab('Dashboard'))
        .then(() => genericLib.checkMirantisRefsOnTab('Nodes'))
        .then(() => genericLib.checkMirantisRefsOnTab('Networks'))
        /* @FIXME: uncomment "Settings" tab check after have will merged: 
          https://review.openstack.org/#/c/321997
        .then(() => genericLib.checkMirantisRefsOnTab('Settings'))
        */
        .then(() => genericLib.checkMirantisRefsOnTab('Logs'))
        .then(() => genericLib.checkMirantisRefsOnTab('Health Check'));
    }
  };
});
