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
import assert from 'intern/chai!assert';
import Common from 'tests/functional/pages/common';
import ModalWindow from 'tests/functional/pages/modal';
import 'tests/functional/helpers';

registerSuite(() => {
  var common,
    clusterName;

  return {
    name: 'Clusters page',
    setup() {
      common = new Common(this.remote);
      clusterName = common.pickRandomName('Test Cluster');

      return this.remote
        .then(() => common.getIn());
    },
    beforeEach() {
      return this.remote
        .then(() => common.createCluster(clusterName))
        .waitForCssSelector('.clusters-page', 20000);
    },
    afterEach() {
      return this.remote
        .then(() => common.removeCluster(clusterName));
    },
    'Create Cluster'() {
      return this.remote
        .then(() => common.doesClusterExist(clusterName))
        .then((result) => assert.ok(result, 'Newly created cluster found in the list'));
    },
    'Attempt to create cluster with duplicate name'() {
      return this.remote
        .clickLinkByText('Environments')
        .waitForCssSelector('.clusters-page', 2000)
        .then(
          () => common.createCluster(
            clusterName,
            {
              'Name and Release': () => {
                var modal = new ModalWindow(this.remote);
                return this.remote
                  .pressKeys('\uE007')
                  .assertElementTextEquals(
                    '.create-cluster-form span.help-block',
                    'Environment with this name already exists',
                    'Error message should say that environment with that name already exists'
                  )
                  .then(() => modal.close());
              }
            }
          )
        );
    },
    'Testing cluster list page'() {
      return this.remote
        .clickLinkByText('Environments')
        .waitForCssSelector('.clusters-page', 2000)
        .assertElementAppears('.clusters-page .clusterbox', 2000, 'Cluster container exists')
        .assertElementExists('.create-cluster', 'Cluster creation control exists');
    }
  };
});
