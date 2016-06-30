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
      name: 'C842463',
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
      'Test network, -vmware, -dvs, +hyperv*, bind:tun': function() {
//        var vmware = 'input[value=hypervisor\\:vmware]',
//            contrail = 'input[value=network\\:neutron\\:contrail]'
//
//        return this.remote
//          .pressKeys('\uE007')  // go to Compute
//
//          // Check that Contrail network is disabled when vCenter hypervisor is selected
//          .clickByCssSelector(vmware)
//          .pressKeys('\uE007')  // Networking
//          .assertElementDisabled(contrail, 'Contrail is enabled with vCenter')
//
//          // Go back to Compute and disable vCenter
//          .clickByCssSelector('.prev-pane-btn')
//          .clickByCssSelector(vmware)
//
//          .pressKeys('\uE007')  // Networking
//
//          // Create cluster with qemu + Contrail network + block ceph + Sahara
//          .clickByCssSelector(contrail)
//          .pressKeys('\uE007')  // Storage
//          .clickByCssSelector('input[value=storage\\:block\\:ceph]')
//          .pressKeys('\uE007')  // Additional Services
//          .clickByCssSelector('input[value=additional_service\\:sahara]')
//          .pressKeys('\uE007')  // Finish
//          .pressKeys('\uE007')  // Create
//          .then(function() {
//            return modal.waitToOpen().sleep(100);
//          })
//
//          // Delete created environment
//          .clickByCssSelector('button.delete-environment-btn')
//          .clickByCssSelector('button.remove-cluster-btn');
      }
    };
  });
});
