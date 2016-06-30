/*
 * Copyright 2016 Mirantis, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
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
  'tests/functional/component_registry/component_helpers',
  'tests/functional/pages/common',
  'tests/functional/pages/modal'
], function(registerSuite, assert, helpers, componentHelpers, Common, Modal) {

  registerSuite(function() {
    var common, modal;

    return {
      name: 'Networking',
      setup: function() {
        common = new Common(this.remote);
        modal = new Modal(this.remote);
        return this.remote
         .then(function() {
              return common.getIn();
         });
      },
      'Test network, -vmware, -dvs, +hyperv*, bind:tun': function() {
        var vmware = 'input[name=hypervisor\\:vmware]';
        var contrail = 'input[value=network\\:neutron\\:contrail]';

        return this.remote
          .updatePlugin('dvs_default test_network_contr_binded')
          .newClusterFillName(modal)

          .pressKeys('\uE007')  // go to Compute

          // Check that Contrail is disabled when vCenter is enabled
          .clickByCssSelector(vmware)
          .pressKeys('\uE007')  // Network
          .assertElementDisabled(contrail, 'Contrail is enabled with vCenter')
          // Go back to Compute and disable vCenter
          .clickByCssSelector('.prev-pane-btn')
          .clickByCssSelector(vmware)

          // Create cluster with qemu + Contrail network + ceph + Sahara
          .pressKeys('\uE007')  // Networking
          .clickByCssSelector(contrail)
          .pressKeys('\uE007')  // Storage
          .clickByCssSelector('input[value=storage\\:block\\:ceph]')
          .pressKeys('\uE007')  // Additional Services
          .clickByCssSelector('input[value=additional_service\\:sahara]')
          .pressKeys('\uE007')  // Finish
          .pressKeys('\uE007')  // Create
          .then(function() {
            return modal.waitToClose();
          })

          // Check that all network configuration of neutron tun is available in Network tab
          .clickByCssSelector('a.network.cluster-tab')
          .assertElementTextEquals('.title .segmentation-type',
                                   '(Neutron with tunneling segmentation)',
                                   'No tunneling segmentation message')

          // Back to Dashboard and delete created environment
          .clickByCssSelector('a.dashboard.cluster-tab')
          .deleteCluster(modal);
      },
      'Create cluster with vCenter + dvs network': function() {
        return this.remote
          .updatePlugin('dvs_default test_network_contr_binded')
          .newClusterFillName(modal)

          .pressKeys('\uE007')  // go to Compute

          // Create cluster with vCenter + dvs network
          .clickByCssSelector('input[name=hypervisor\\:vmware]')
          .pressKeys('\uE007')  // go to Networking
          .clickByCssSelector('input[value=network\\:neutron\\:ml2\\:dvs]')

          // Create env with vCenter + nsxv
          .pressKeys('\uE007')  // Storage
          .pressKeys('\uE007')  // Additional Services
          .pressKeys('\uE007')  // Finish
          .pressKeys('\uE007')  // Create
          .then(function() {
            return modal.waitToClose();
          })

          // Delete created environment
          .deleteCluster(modal);
      },
      'Test that it is not possibility to create cluster with nsx + dvs': function() {
        return this.remote
          .updatePlugin('dvs_default nsxv_default')
          .newClusterFillName(modal)

          .pressKeys('\uE007')  // go to Compute
            .clickByCssSelector('input[name=hypervisor\\:vmware]')  // enable vCenter
            .pressKeys('\uE007')  // Networking

            // Check that there is no possibility to select multiple networks neutron:nsx and
            // neutron:ml2:dvs (choose nsxv, then ml2 + vlan + dvs)
            .clickByCssSelector('input[value=network\\:neutron\\:core\\:nsx]')
            .clickByCssSelector('input[value=network\\:neutron\\:core\\:ml2]')
            .clickByCssSelector('input[name=network\\:neutron\\:ml2\\:vlan]')
            .clickByCssSelector('input[name=network\\:neutron\\:ml2\\:dvs]')

            // Create env with vCenter + ml2
            .pressKeys('\uE007')  // Storage
            .pressKeys('\uE007')  // Additional Services
            .pressKeys('\uE007')  // Finish
            .pressKeys('\uE007')  // Create
            .then(function() {
              return modal.waitToClose();
            })

            // Delete created environment
            .deleteCluster(modal);
      },
      'Create cluster with neutron:nsx': function() {
        return this.remote
          .updatePlugin('dvs_default nsxv_default')
          .newClusterFillName(modal)

          .pressKeys('\uE007')  // go to Compute
          .clickByCssSelector('input[name=hypervisor\\:vmware]')  // enable vCenter
          .pressKeys('\uE007')  // Networking

          // Check that there is no possibility to select multiple networks neutron:nsx and
          // neutron:ml2:dvs (choose nsxv)
          .clickByCssSelector('input[value=network\\:neutron\\:core\\:nsx]')

          // Create env with vCenter + nsxv
          .pressKeys('\uE007')  // Storage
          .pressKeys('\uE007')  // Additional Services
          .pressKeys('\uE007')  // Finish
          .pressKeys('\uE007')  // Create
          .then(function() {
            return modal.waitToClose();
          })

          // Delete created environment
          .deleteCluster(modal);
      },
      'Test network, -contrail, !ml2, !vmware': function() {
        return this.remote
          .updatePlugin('contrail_default test_network_ml2')
          .newClusterFillName(modal)

          .pressKeys('\uE007')  // go to Compute
          .pressKeys('\uE007')  // Networking

          // Check in wizard that network contrail is blocked when dvs network is selected
          // (choose contrail)
          .clickByCssSelector('input[value=network\\:neutron\\:contrail]')

          // Create cluster with contrail
          .pressKeys('\uE007')  // Storage
          .pressKeys('\uE007')  // Additional Services
          .pressKeys('\uE007')  // Finish
          .pressKeys('\uE007')  // Create
          .then(function() {
            return modal.waitToClose();
          })

          // Delete created environment
          .deleteCluster(modal);
      },
      'Test network, -tun, -e:ceph, !Sahara, !ml2, +dvs, +b:ceph, +qemu, +Murano': function() {
        var vmware = 'input[value=hypervisor\\:vmware]';
        var xen = 'input[value=hypervisor\\:xen]';
        var vlan = 'input[value=network\\:neutron\\:ml2\\:vlan]';
        var tun = 'input[value=network\\:neutron\\:ml2\\:tun]';
        var frog = 'input[value=network\\:neutron\\:ml2\\:frog]';

        return this.remote
          .updatePlugin('dvs_default test_network_ml2_frog')
          .newClusterFillName(modal)

          .pressKeys('\uE007')  // go to Compute

          // Check that xen is incompatible with vCenter
          .clickByCssSelector(vmware)
          .assertElementDisabled(xen, 'Xen is enabled with vCenter')
          .clickByCssSelector(vmware)
          .clickByCssSelector(xen)
          .assertElementDisabled(vmware, 'vCenter is enabled with xen')
          .clickByCssSelector(xen)

          // Check that frog is disabled with ml2:tun
          .pressKeys('\uE007')  // Networking
          .clickByCssSelector(vlan)
          .clickByCssSelector(tun)
          .assertElementDisabled(frog, 'frog is enabled with tun')
          .clickByCssSelector(tun)
          .clickByCssSelector(vlan)

          // Create cluster with KVM + vCenter, frog + DVS network, Sahara + Murano
          .clickByCssSelector('button.prev-pane-btn')  // back to Compute
          .clickByCssSelector(vmware)
          .pressKeys('\uE007')  // Networking
          .clickByCssSelector('input[value=network\\:neutron\\:ml2\\:dvs]')
          .clickByCssSelector(frog)
          .pressKeys('\uE007')  // Storage
          .assertElementDisabled('input[value=storage\\:ephemeral\\:ceph]',
                                 'Ephemerap Ceph is enabled with frog')
          .pressKeys('\uE007')  // Additional Services
          .clickByCssSelector('input[value=additional_service\\:sahara]')
          .clickByCssSelector('input[value=additional_service\\:murano]')
          .pressKeys('\uE007')  // Finish
          .pressKeys('\uE007')  // Create
          .then(function() {
            return modal.waitToClose();
          })

          // Delete created environment
          .deleteCluster(modal);
      },
      'Test create cluster without required Sahara': function() {
        return this.remote
          .updatePlugin('dvs_default test_network_ml2_frog')
          .newClusterFillName(modal)

          .pressKeys('\uE007')  // go to Compute

          // Try to create cluster with KVM + vCenter hypervisors, frog + DVS network
          // without Sahara additional service (should not be created)
          .clickByCssSelector('input[value=hypervisor\\:vmware]')
          .pressKeys('\uE007')  // Networking
          .clickByCssSelector('input[value=network\\:neutron\\:ml2\\:frog]')
          .clickByCssSelector('input[value=network\\:neutron\\:ml2\\:dvs]')
          .pressKeys('\uE007')  // Storage
          .pressKeys('\uE007')  // Additional Services
          .pressKeys('\uE007')  // Finish
          .pressKeys('\uE007')  // Create
          .then(function() {
            return modal.waitToClose();
          })
          .assertElementTextEquals('.text-error', 'Requires [u\'additional_service:sahara\'] for ' +
                                   '\'network:neutron:ml2:frog\' components were not satisfied.',
                                   'Error was not displayed')
          .then(function() {
            return modal.close();
          });
      }
    };
  });
});
