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

define([
  'intern!object',
  'intern/chai!assert',
  'tests/functional/helpers',
  'tests/functional/pages/common',
  'tests/functional/pages/modal'
], function(registerSuite, assert, helpers, Common, Modal) {
  registerSuite(function() {
    var common, modal;

    return {
      name: 'C842452',
      setup: function() {
        common = new Common(this.remote);
        modal = new Modal(this.remote);
        return this.remote
          .then(function() {
            return common.getIn();
          });
      },
      beforeEach: function() {
        var clusterName = common.pickRandomName('Temp');
        return this.remote
          .clickByCssSelector('.create-cluster')
          .then(function() {
            return modal.waitToOpen();
          })
          .setInputValue('[name=name]', clusterName);
      },
      'Test that when vcenter is selected as compute, contrail should be turned off': function() {
        return this.remote
          .pressKeys('\uE007')  // go to Compute

          // Check that contrail is disabled when vCenter is enabled
          .clickByCssSelector('input[value=hypervisor\\:vmware]')
          .pressKeys('\uE007')  // Networking
          .assertElementDisabled('input[value=network\\:neutron\\:contrail]',
                                 'Contrail checkbox is enabled with vCenter')
          .then(function() {
            return modal.close();
          });
      }
    };
  });
});
