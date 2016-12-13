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

import registerSuite from 'intern!object';
import Common from 'tests/functional/pages/common';
import Modal from 'tests/functional/pages/modal';
import 'tests/functional/helpers';
import 'tests/functional/real_plugin/plugin_helpers';

registerSuite(() => {
  var common, modal;

  return {
    name: 'Networking',
    setup() {
      common = new Common(this.remote);
      modal = new Modal(this.remote);
      return this.remote
       .then(() => common.getIn());
    },
    afterEach() {
      return this.remote
        .then(() => modal.close())
        .catch(() => true)
        .then(() => modal.waitToClose());
    },
    'Test network, -vmware, -dvs, +hyperv*, bind:tun'() {
      var vmware = 'input[name=hypervisor\\:vmware]';
      var contrail = 'input[value=network\\:neutron\\:contrail]';

      return this.remote
        .updatePlugin('dvs_default test_network_contr_binded')
        .newClusterFillName(modal)

        .pressKeys('\uE007')  // go to Compute

        // Check that Contrail is disabled when vCenter is enabled
        .clickByCssSelector(vmware)
        .assertNextButtonEnabled()
        .pressKeys('\uE007')  // Networking
        // Go back to Compute and disable vCenter
        .clickByCssSelector('.prev-pane-btn')
        .clickByCssSelector(vmware)

        // Create cluster with qemu + Contrail network + ceph + Sahara
        .assertNextButtonEnabled()
        .pressKeys('\uE007')  // Networking
        .clickByCssSelector(contrail)
        .assertNextButtonEnabled()
        .pressKeys('\uE007')  // Storage
        .clickByCssSelector('input[value=storage\\:block\\:ceph]')
        .pressKeys('\uE007')  // Additional Services
        .clickByCssSelector('input[value=additional_service\\:sahara]')
        .pressKeys('\uE007')  // Finish
        .pressKeys('\uE007')  // Create
        .then(() => modal.waitToClose())

        // Check that all network configuration of neutron tun is available in Network tab
        .clickByCssSelector('a.network.cluster-tab')
        .assertElementTextEquals('.title .segmentation-type',
                                 '(Neutron with tunneling segmentation)',
                                 'No tunneling segmentation message')

        // Back to Dashboard and delete created environment
        .clickByCssSelector('a.dashboard.cluster-tab')
        .deleteCluster(modal);
    },
    'Create cluster with vCenter + dvs network'() {
      return this.remote
        .updatePlugin('dvs_default test_network_contr_binded')
        .newClusterFillName(modal)

        .pressKeys('\uE007')  // go to Compute

        // Create cluster with vCenter + dvs network
        .clickByCssSelector('input[name=hypervisor\\:vmware]')
        .assertNextButtonEnabled()
        .pressKeys('\uE007')  // go to Networking
        .clickByCssSelector('input[value=network\\:neutron\\:ml2\\:dvs]')

        // Create env with vCenter + nsxv
        .assertNextButtonEnabled()
        .pressKeys('\uE007')  // Storage
        .pressKeys('\uE007')  // Additional Services
        .pressKeys('\uE007')  // Finish
        .pressKeys('\uE007')  // Create
        .then(() => modal.waitToClose())

        // Delete created environment
        .deleteCluster(modal);
    },
    'Test that it is not possibility to create cluster with nsx + dvs'() {
      return this.remote
        .updatePlugin('dvs_default nsxv_default')
        .newClusterFillName(modal)

        .pressKeys('\uE007')  // go to Compute
          .clickByCssSelector('input[name=hypervisor\\:vmware]')  // enable vCenter
          .assertNextButtonEnabled()
          .pressKeys('\uE007')  // Networking

          // Check that there is no possibility to select multiple networks neutron:nsx and
          // neutron:ml2:dvs (choose nsxv, then ml2 + vlan + dvs)
          .clickByCssSelector('input[value=network\\:neutron\\:core\\:nsx]')
          .clickByCssSelector('input[value=network\\:neutron\\:core\\:ml2]')
          .clickByCssSelector('input[name=network\\:neutron\\:ml2\\:vlan]')
          .clickByCssSelector('input[name=network\\:neutron\\:ml2\\:dvs]')

          // Create env with vCenter + ml2
          .assertNextButtonEnabled()
          .pressKeys('\uE007')  // Storage
          .pressKeys('\uE007')  // Additional Services
          .pressKeys('\uE007')  // Finish
          .pressKeys('\uE007')  // Create
          .then(() => modal.waitToClose())

          // Delete created environment
          .deleteCluster(modal);
    },
    'Create cluster with neutron:nsx'() {
      return this.remote
        .updatePlugin('dvs_default nsxv_default')
        .newClusterFillName(modal)

        .pressKeys('\uE007')  // go to Compute
        .clickByCssSelector('input[name=hypervisor\\:vmware]')  // enable vCenter
        .assertNextButtonEnabled()
        .pressKeys('\uE007')  // Networking

        // Check that there is no possibility to select multiple networks neutron:nsx and
        // neutron:ml2:dvs (choose nsxv)
        .clickByCssSelector('input[value=network\\:neutron\\:core\\:nsx]')

        // Create env with vCenter + nsxv
        .assertNextButtonEnabled()
        .pressKeys('\uE007')  // Storage
        .pressKeys('\uE007')  // Additional Services
        .pressKeys('\uE007')  // Finish
        .pressKeys('\uE007')  // Create
        .then(() => modal.waitToClose())

        // Delete created environment
        .deleteCluster(modal);
    },
    'Test network, -contrail, !ml2, !vmware'() {
      return this.remote
        .updatePlugin('contrail_default test_network_ml2')
        .newClusterFillName(modal)

        .pressKeys('\uE007')  // go to Compute
        .assertNextButtonEnabled()
        .pressKeys('\uE007')  // Networking

        // Check in wizard that network contrail is blocked when dvs network is selected
        // (choose contrail)
        .clickByCssSelector('input[value=network\\:neutron\\:contrail]')

        // Create cluster with contrail
        .assertNextButtonEnabled()
        .pressKeys('\uE007')  // Storage
        .pressKeys('\uE007')  // Additional Services
        .pressKeys('\uE007')  // Finish
        .pressKeys('\uE007')  // Create
        .then(() => modal.waitToClose())

        // Delete created environment
        .deleteCluster(modal);
    },
    'Test network, -tun, -e:ceph, !Sahara, !ml2, +dvs, +b:ceph, +qemu, +Murano'() {
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
        .assertNextButtonEnabled()
        .pressKeys('\uE007')  // Networking
        .clickByCssSelector(vlan)
        .clickByCssSelector(tun)
        .assertElementDisabled(frog, 'frog is enabled with tun')
        .clickByCssSelector(tun)
        .clickByCssSelector(vlan)

        // Create cluster with KVM + vCenter, frog + DVS network, Sahara + Murano
        .clickByCssSelector('button.prev-pane-btn')  // back to Compute
        .clickByCssSelector(vmware)
        .assertNextButtonEnabled()
        .pressKeys('\uE007')  // Networking
        .clickByCssSelector('input[value=network\\:neutron\\:ml2\\:dvs]')
        .clickByCssSelector(frog)
        .assertNextButtonEnabled()
        .pressKeys('\uE007')  // Storage
        .assertElementDisabled('input[value=storage\\:ephemeral\\:ceph]',
                               'Ephemerap Ceph is enabled with frog')
        .pressKeys('\uE007')  // Additional Services
        .clickByCssSelector('input[value=additional_service\\:sahara]')
        .clickByCssSelector('input[value=additional_service\\:murano]')
        .pressKeys('\uE007')  // Finish
        .pressKeys('\uE007')  // Create
        .then(() => modal.waitToClose())

        // Delete created environment
        .deleteCluster(modal);
    },
    'Test create cluster without required Sahara'() {
      return this.remote
        .updatePlugin('dvs_default test_network_ml2_frog')
        .newClusterFillName(modal)

        .pressKeys('\uE007')  // go to Compute

        // Try to create cluster with KVM + vCenter hypervisors, frog + DVS network
        // without Sahara additional service (should not be created)
        .clickByCssSelector('input[value=hypervisor\\:vmware]')
        .assertNextButtonEnabled()
        .pressKeys('\uE007')  // Networking
        .clickByCssSelector('input[value=network\\:neutron\\:ml2\\:frog]')
        .clickByCssSelector('input[value=network\\:neutron\\:ml2\\:dvs]')
        .assertNextButtonEnabled()
        .pressKeys('\uE007')  // Storage
        .pressKeys('\uE007')  // Additional Services
        .pressKeys('\uE007')  // Finish
        .pressKeys('\uE007')  // Create
        .then(() => modal.waitToClose())
        .assertElementTextEquals('.text-error', 'Component \'network:neutron:ml2:frog\' ' +
                                 'requires any of components from [u\'additional_service:' +
                                 'sahara\'] set.', 'Error was not displayed');
    }
  };
});
