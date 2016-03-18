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
import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';
import React from 'react';
import i18n from 'i18n';
import utils from 'utils';
import models from 'models';
import dispatcher from 'dispatcher';
import OffloadingModes from 'views/cluster_page_tabs/nodes_tab_screens/offloading_modes_control';
import {Input} from 'views/controls';
import {backboneMixin, unsavedChangesMixin} from 'component_mixins';
import {DragSource, DropTarget} from 'react-dnd';
import ReactDOM from 'react-dom';

var ns = 'cluster_page.nodes_tab.configure_interfaces.';

var EditNodeInterfacesScreen = React.createClass({
  mixins: [
    backboneMixin('interfaces', 'change reset update'),
    backboneMixin('cluster'),
    backboneMixin('nodes', 'change reset update'),
    unsavedChangesMixin
  ],
  statics: {
    fetchData(options) {
      var cluster = options.cluster;
      var nodes = utils.getNodeListFromTabOptions(options);

      if (!nodes || !nodes.areInterfacesConfigurable()) {
        return $.Deferred().reject();
      }

      var networkConfiguration = cluster.get('networkConfiguration');
      var networksMetadata = new models.ReleaseNetworkProperties();

      return $.when(...nodes.map((node) => {
        node.interfaces = new models.Interfaces();
        return node.interfaces.fetch({
          url: _.result(node, 'url') + '/interfaces',
          reset: true
        });
      }).concat([
        networkConfiguration.fetch({cache: true}),
        networksMetadata.fetch({
          url: '/api/releases/' + cluster.get('release_id') + '/networks'
        })]))
        .then(() => {
          var interfaces = new models.Interfaces();
          interfaces.set(_.cloneDeep(nodes.at(0).interfaces.toJSON()), {parse: true});
          return {
            interfaces: interfaces,
            nodes: nodes,
            bondingConfig: networksMetadata.get('bonding'),
            configModels: {
              version: app.version,
              cluster: cluster,
              settings: cluster.get('settings')
            }
          };
        });
    }
  },
  getInitialState() {
    return {
      actionInProgress: false,
      interfacesErrors: {}
    };
  },
  componentWillMount() {
    this.setState({initialInterfaces: _.cloneDeep(this.interfacesToJSON(this.props.interfaces))});
  },
  componentDidMount() {
    this.validate();
  },
  isLocked() {
    return !!this.props.cluster.task({group: 'deployment', active: true}) ||
      !_.all(this.props.nodes.invoke('areInterfacesConfigurable'));
  },
  interfacesPickFromJSON(json) {
    // Pick certain interface fields that have influence on hasChanges.
    return _.pick(json, [
      'assigned_networks', 'mode', 'type', 'slaves', 'bond_properties',
      'interface_properties', 'offloading_modes'
    ]);
  },
  interfacesToJSON(interfaces, remainingNodesMode) {
    // Sometimes 'state' is sent from the API and sometimes not
    // It's better to just unify all inputs to the one without state.
    var picker = remainingNodesMode ? this.interfacesPickFromJSON : (json) => _.omit(json, 'state');
    return interfaces.map((ifc) => picker(ifc.toJSON()));
  },
  hasChangesInRemainingNodes() {
    var initialInterfacesData = _.map(this.state.initialInterfaces, this.interfacesPickFromJSON);
    return _.any(this.props.nodes.slice(1), (node) => {
      var interfacesData = this.interfacesToJSON(node.interfaces, true);
      return _.any(initialInterfacesData, (ifcData, index) => {
        return _.any(ifcData, (data, attribute) => {
          if (attribute === 'slaves') {
            // bond 'slaves' attribute contains information about slave name only
            // but interface names can be different between nodes
            // and can not be used for the comparison
            return data.length !== (interfacesData[index].slaves || {}).length;
          }
          return !_.isEqual(data, interfacesData[index][attribute]);
        });
      });
    });
  },
  hasChanges() {
    return !this.isLocked() &&
      (!_.isEqual(this.state.initialInterfaces, this.interfacesToJSON(this.props.interfaces)) ||
      this.props.nodes.length > 1 && this.hasChangesInRemainingNodes());
  },
  loadDefaults() {
    this.setState({actionInProgress: true});
    $.when(this.props.interfaces.fetch({
      url: _.result(this.props.nodes.at(0), 'url') + '/interfaces/default_assignment', reset: true
    }, this)).done(() => {
      this.setState({actionInProgress: false});
    }).fail((response) => {
      var errorNS = ns + 'configuration_error.';
      utils.showErrorDialog({
        title: i18n(errorNS + 'title'),
        message: i18n(errorNS + 'load_defaults_warning'),
        response: response
      });
    });
  },
  revertChanges() {
    this.props.interfaces.reset(_.cloneDeep(this.state.initialInterfaces), {parse: true});
  },
  applyChanges() {
    if (!this.isSavingPossible()) return $.Deferred().reject();

    var nodes = this.props.nodes;
    var interfaces = this.props.interfaces;
    var bonds = interfaces.filter((ifc) => ifc.isBond());
    var bondsByName = bonds.reduce((result, bond) => {
      result[bond.get('name')] = bond;
      return result;
    }, {});

    // bonding map contains indexes of slave interfaces
    // it is needed to build the same configuration for all the nodes
    // as interface names might be different, so we use indexes
    var bondingMap = _.map(bonds,
      (bond) => _.map(bond.get('slaves'), (slave) => interfaces.indexOf(interfaces.find(slave)))
    );

    this.setState({actionInProgress: true});
    return $.when(...nodes.map((node) => {
      var oldNodeBonds, nodeBonds;
      // removing previously configured bonds
      oldNodeBonds = node.interfaces.filter((ifc) => ifc.isBond());
      node.interfaces.remove(oldNodeBonds);
      // creating node-specific bonds without slaves
      nodeBonds = _.map(bonds, (bond) => {
        return new models.Interface(_.omit(bond.toJSON(), 'slaves'), {parse: true});
      });
      node.interfaces.add(nodeBonds);
      // determining slaves using bonding map
      _.each(nodeBonds, (bond, bondIndex) => {
        var slaveIndexes = bondingMap[bondIndex];
        var slaveInterfaces = _.map(slaveIndexes, node.interfaces.at, node.interfaces);
        bond.set({slaves: _.invoke(slaveInterfaces, 'pick', 'name')});
      });

      // Assigning networks according to user choice and interface properties
      node.interfaces.each((ifc, index) => {
        var updatedIfc = ifc.isBond() ? bondsByName[ifc.get('name')] : interfaces.at(index);
        ifc.set({
          assigned_networks: new models.InterfaceNetworks(
            updatedIfc.get('assigned_networks').toJSON()
          ),
          interface_properties: updatedIfc.get('interface_properties')
        });
        if (ifc.isBond()) {
          var bondProperties = ifc.get('bond_properties');
          ifc.set({bond_properties: _.extend(bondProperties, {type__:
            this.getBondType() === 'linux' ? 'linux' : 'ovs'})});
        }
        if (ifc.get('offloading_modes')) {
          ifc.set({
            offloading_modes: updatedIfc.get('offloading_modes')
          });
        }
      });

      return Backbone.sync('update', node.interfaces, {url: _.result(node, 'url') + '/interfaces'});
    }))
      .done(() => {
        this.setState({initialInterfaces:
          _.cloneDeep(this.interfacesToJSON(this.props.interfaces))});
        dispatcher.trigger('networkConfigurationUpdated');
      })
      .fail((response) => {
        var errorNS = ns + 'configuration_error.';

        utils.showErrorDialog({
          title: i18n(errorNS + 'title'),
          message: i18n(errorNS + 'saving_warning'),
          response: response
        });
      }).always(() => {
        this.setState({actionInProgress: false});
      });
  },
  configurationTemplateExists() {
    return !_.isEmpty(this.props.cluster.get('networkConfiguration')
      .get('networking_parameters').get('configuration_template'));
  },
  bondingAvailable() {
    var availableBondTypes = this.getBondType();
    return !!availableBondTypes && !this.configurationTemplateExists();
  },
  getBondType() {
    return _.compact(_.flatten(_.map(this.props.bondingConfig.availability,
      (modeAvailabilityData) => {
        return _.map(modeAvailabilityData, (condition, name) => {
          var result = utils.evaluateExpression(condition, this.props.configModels).value;
          return result && name;
        });
      })))[0];
  },
  findOffloadingModesIntersection(set1, set2) {
    return _.map(
      _.intersection(
        _.pluck(set1, 'name'),
        _.pluck(set2, 'name')
      ),
      (name) => {
        return {
          name: name,
          state: null,
          sub: this.findOffloadingModesIntersection(
            _.find(set1, {name: name}).sub,
            _.find(set2, {name: name}).sub
          )
        };
      });
  },
  getIntersectedOffloadingModes(interfaces) {
    var offloadingModes = interfaces.map((ifc) => ifc.get('offloading_modes') || []);
    if (!offloadingModes.length) return [];

    return offloadingModes.reduce((result, modes) => {
      return this.findOffloadingModesIntersection(result, modes);
    });
  },
  bondInterfaces() {
    this.setState({actionInProgress: true});
    var interfaces = this.props.interfaces.filter((ifc) => ifc.get('checked') && !ifc.isBond());
    var bonds = this.props.interfaces.find((ifc) => ifc.get('checked') && ifc.isBond());
    var bondingProperties = this.props.bondingConfig.properties;

    if (!bonds) {
      // if no bond selected - create new one
      var bondMode = _.flatten(_.pluck(bondingProperties[this.getBondType()].mode, 'values'))[0];
      bonds = new models.Interface({
        type: 'bond',
        name: this.props.interfaces.generateBondName(this.getBondType() ===
          'linux' ? 'bond' : 'ovs-bond'),
        mode: bondMode,
        assigned_networks: new models.InterfaceNetworks(),
        slaves: _.invoke(interfaces, 'pick', 'name'),
        bond_properties: {
          mode: bondMode
        },
        interface_properties: {
          mtu: null,
          disable_offloading: true
        },
        offloading_modes: this.getIntersectedOffloadingModes(interfaces)
      });
    } else {
      // adding interfaces to existing bond
      bonds.set({
        slaves: bonds.get('slaves').concat(_.invoke(interfaces, 'pick', 'name')),
        offloading_modes: this.getIntersectedOffloadingModes(interfaces.concat(bonds))
      });
      // remove the bond to add it later and trigger re-rendering
      this.props.interfaces.remove(bonds, {silent: true});
    }
    _.each(interfaces, (ifc) => {
      bonds.get('assigned_networks').add(ifc.get('assigned_networks').models);
      ifc.get('assigned_networks').reset();
      ifc.set({checked: false});
    });
    this.props.interfaces.add(bonds);
    this.setState({actionInProgress: false});
  },
  unbondInterfaces() {
    this.setState({actionInProgress: true});
    _.each(this.props.interfaces.where({checked: true}), (bond) => {
      return this.removeInterfaceFromBond(bond.get('name'));
    });
    this.setState({actionInProgress: false});
  },
  removeInterfaceFromBond(bondName, slaveInterfaceName) {
    var networks = this.props.cluster.get('networkConfiguration').get('networks');
    var bond = this.props.interfaces.find({name: bondName});
    var slaves = bond.get('slaves');
    var bondHasUnmovableNetwork = bond.get('assigned_networks').any((interfaceNetwork) => {
      return interfaceNetwork.getFullNetwork(networks).get('meta').unmovable;
    });
    var slaveInterfaceNames = _.pluck(slaves, 'name');
    var targetInterface = bond;

    // if PXE interface is being removed - place networks there
    if (bondHasUnmovableNetwork) {
      var pxeInterface = this.props.interfaces.find((ifc) => {
        return ifc.get('pxe') && _.contains(slaveInterfaceNames, ifc.get('name'));
      });
      if (!slaveInterfaceName || pxeInterface && pxeInterface.get('name') === slaveInterfaceName) {
        targetInterface = pxeInterface;
      }
    }

    // if slaveInterfaceName is set - remove it from slaves, otherwise remove all
    if (slaveInterfaceName) {
      var slavesUpdated = _.reject(slaves, {name: slaveInterfaceName});
      var names = _.pluck(slavesUpdated, 'name');
      var bondSlaveInterfaces = this.props.interfaces.filter((ifc) => {
        return _.contains(names, ifc.get('name'));
      });

      bond.set({
        slaves: slavesUpdated,
        offloading_modes: this.getIntersectedOffloadingModes(bondSlaveInterfaces)
      });
    } else {
      bond.set('slaves', []);
    }

    // destroy bond if all slave interfaces have been removed
    if (!slaveInterfaceName && targetInterface === bond) {
      targetInterface = this.props.interfaces.findWhere({name: slaveInterfaceNames[0]});
    }

    // move networks if needed
    if (targetInterface !== bond) {
      var interfaceNetworks = bond.get('assigned_networks').remove(
        bond.get('assigned_networks').models
      );
      targetInterface.get('assigned_networks').add(interfaceNetworks);
    }

    // if no slaves left - remove the bond
    if (!bond.get('slaves').length) {
      this.props.interfaces.remove(bond);
    }
  },
  validate() {
    var interfacesErrors = {};
    var validationResult;
    var networkConfiguration = this.props.cluster.get('networkConfiguration');
    var networkingParameters = networkConfiguration.get('networking_parameters');
    var networks = networkConfiguration.get('networks');
    if (!this.props.interfaces) {
      return;
    }
    this.props.interfaces.each((ifc) => {
      validationResult = ifc.validate({
        networkingParameters: networkingParameters,
        networks: networks
      });

      if (!_.isEmpty(validationResult)) {
        interfacesErrors[ifc.get('name')] = validationResult;
      }
    });

    if (!_.isEqual(this.state.interfacesErrors, interfacesErrors)) {
      this.setState({interfacesErrors});
    }
  },
  validateSpeedsForBonding(interfaces) {
    var slaveInterfaces = _.flatten(_.invoke(interfaces, 'getSlaveInterfaces'), true);
    var speeds = _.invoke(slaveInterfaces, 'get', 'current_speed');
    // warn if not all speeds are the same or there are interfaces with unknown speed
    return _.uniq(speeds).length > 1 || !_.compact(speeds).length;
  },
  isSavingPossible() {
    return !_.chain(this.state.interfacesErrors).values().some().value() &&
      !this.state.actionInProgress && this.hasChanges();
  },
  getIfcProperty(property) {
    var {interfaces, nodes} = this.props;
    var bondsCount = interfaces.filter((ifc) => ifc.isBond()).length;
    var getPropertyValues = (ifcIndex) => {
      return _.uniq(nodes.map((node) => {
        var nodeBondsCount = node.interfaces.filter((ifc) => ifc.isBond()).length;
        var nodeInterface = node.interfaces.at(ifcIndex + nodeBondsCount);
        if (property === 'current_speed') return utils.showBandwidth(nodeInterface.get(property));
        return nodeInterface.get(property);
      }));
    };
    return interfaces.map((ifc, index) => {
      if (ifc.isBond()) {
        return _.map(ifc.get('slaves'),
          (slave) => getPropertyValues(interfaces.indexOf(interfaces.find(slave)) - bondsCount)
        );
      }
      return [getPropertyValues(index - bondsCount)];
    });
  },
  render() {
    var {nodes, interfaces} = this.props;
    var nodeNames = nodes.pluck('name');
    var locked = this.isLocked();
    var bondingAvailable = this.bondingAvailable();
    var configurationTemplateExists = this.configurationTemplateExists();
    var checkedInterfaces = interfaces.filter((ifc) => ifc.get('checked') && !ifc.isBond());
    var checkedBonds = interfaces.filter((ifc) => ifc.get('checked') && ifc.isBond());
    var creatingNewBond = checkedInterfaces.length >= 2 && !checkedBonds.length;
    var addingInterfacesToExistingBond = !!checkedInterfaces.length && checkedBonds.length === 1;
    var bondingPossible = creatingNewBond || addingInterfacesToExistingBond;
    var unbondingPossible = !checkedInterfaces.length && !!checkedBonds.length;
    var hasChanges = this.hasChanges();
    var slaveInterfaceNames = _.pluck(_.flatten(_.filter(interfaces.pluck('slaves'))), 'name');
    var loadDefaultsEnabled = !this.state.actionInProgress;
    var revertChangesEnabled = !this.state.actionInProgress && hasChanges;
    var invalidSpeedsForBonding = bondingPossible &&
      this.validateSpeedsForBonding(checkedBonds.concat(checkedInterfaces)) ||
      interfaces.any((ifc) => ifc.isBond() && this.validateSpeedsForBonding([ifc]));

    var interfaceSpeeds = this.getIfcProperty('current_speed');
    var interfaceNames = this.getIfcProperty('name');
    return (
      <div className='row'>
        <div className='title'>
          {i18n(ns + (locked ? 'read_only_' : '') + 'title',
            {count: nodes.length, name: nodeNames.join(', ')})}
        </div>
        {configurationTemplateExists &&
          <div className='col-xs-12'>
            <div className='alert alert-warning'>
              {i18n(ns + 'configuration_template_warning')}
            </div>
          </div>
        }
        {bondingAvailable && !locked &&
          <div className='col-xs-12'>
            <div className='page-buttons'>
              <div className='well clearfix'>
                <div className='btn-group pull-right'>
                  <button
                    className='btn btn-default btn-bond'
                    onClick={this.bondInterfaces}
                    disabled={!bondingPossible}
                  >
                    {i18n(ns + 'bond_button')}
                  </button>
                  <button
                    className='btn btn-default btn-unbond'
                    onClick={this.unbondInterfaces}
                    disabled={!unbondingPossible}
                  >
                    {i18n(ns + 'unbond_button')}
                  </button>
                </div>
              </div>
            </div>
            {checkedBonds.length > 1 &&
              <div className='alert alert-warning'>{i18n(ns + 'several_bonds_warning')}</div>
            }
            {invalidSpeedsForBonding &&
              <div className='alert alert-warning'>{i18n(ns + 'bond_speed_warning')}</div>
            }
          </div>
        }
        <div className='ifc-list col-xs-12'>
          {interfaces.map((ifc, index) => {
            var ifcName = ifc.get('name');
            if (!_.contains(slaveInterfaceNames, ifcName)) {
              return (
                <NodeInterfaceDropTarget
                  {...this.props}
                  key={'interface-' + ifcName}
                  interface={ifc}
                  hasChanges={
                    !_.isEqual(
                       _.findWhere(this.state.initialInterfaces, {name: ifcName}),
                      _.omit(ifc.toJSON(), 'state')
                    )
                  }
                  locked={locked}
                  bondingAvailable={bondingAvailable}
                  configurationTemplateExists={configurationTemplateExists}
                  errors={this.state.interfacesErrors[ifcName]}
                  validate={this.validate}
                  removeInterfaceFromBond={this.removeInterfaceFromBond}
                  bondingProperties={this.props.bondingConfig.properties}
                  bondType={this.getBondType()}
                  interfaceSpeeds={interfaceSpeeds[index]}
                  interfaceNames={interfaceNames[index]}
                />
              );
            }
          })}
        </div>
        <div className='col-xs-12 page-buttons content-elements'>
          <div className='well clearfix'>
            <div className='btn-group'>
              <a
                className='btn btn-default'
                href={'#cluster/' + this.props.cluster.id + '/nodes'}
                disabled={this.state.actionInProgress}
              >
                {i18n('cluster_page.nodes_tab.back_to_nodes_button')}
              </a>
            </div>
            {!locked &&
              <div className='btn-group pull-right'>
                <button
                  className='btn btn-default btn-defaults'
                  onClick={this.loadDefaults}
                  disabled={!loadDefaultsEnabled}
                >
                  {i18n('common.load_defaults_button')}
                </button>
                <button
                  className='btn btn-default btn-revert-changes'
                  onClick={this.revertChanges}
                  disabled={!revertChangesEnabled}
                >
                  {i18n('common.cancel_changes_button')}
                </button>
                <button
                  className='btn btn-success btn-apply'
                  onClick={this.applyChanges}
                  disabled={!this.isSavingPossible()}
                >
                  {i18n('common.apply_button')}
                </button>
              </div>
            }
          </div>
        </div>
      </div>
    );
  }
});

var NodeInterface = React.createClass({
  statics: {
    target: {
      drop(props, monitor) {
        var targetInterface = props.interface;
        var sourceInterface = props.interfaces.findWhere({name: monitor.getItem().interfaceName});
        var network = sourceInterface.get('assigned_networks')
          .findWhere({name: monitor.getItem().networkName});
        sourceInterface.get('assigned_networks').remove(network);
        targetInterface.get('assigned_networks').add(network);
        // trigger 'change' event to update screen buttons state
        targetInterface.trigger('change', targetInterface);
      },
      canDrop(props, monitor) {
        return monitor.getItem().interfaceName !== props.interface.get('name');
      }
    },
    collect(connect, monitor) {
      return {
        connectDropTarget: connect.dropTarget(),
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop()
      };
    }
  },
  mixins: [
    backboneMixin('interface'),
    backboneMixin({
      modelOrCollection(props) {
        return props.interface.get('assigned_networks');
      }
    })
  ],
  renderedIfcProperties: ['offloading_modes', 'mtu', 'sriov'],
  propTypes: {
    bondingAvailable: React.PropTypes.bool,
    locked: React.PropTypes.bool
  },
  componentDidMount() {
    $('.configuration-panel', ReactDOM.findDOMNode(this))
      .on('show.bs.collapse', () => this.setState({collapsed: true}))
      .on('hide.bs.collapse', () => this.setState({collapsed: false}));
  },
  getInitialState() {
    return {
      activeInterfaceSectionName: null,
      collapsed: true
    };
  },
  isLacpRateAvailable() {
    return _.contains(this.getBondPropertyValues('lacp_rate', 'for_modes'), this.getBondMode());
  },
  isHashPolicyNeeded() {
    return _.contains(this.getBondPropertyValues('xmit_hash_policy', 'for_modes'),
      this.getBondMode());
  },
  getBondMode() {
    var ifc = this.props.interface;
    return ifc.get('mode') || (ifc.get('bond_properties') || {}).mode;
  },
  getAvailableBondingModes() {
    var modes = this.props.bondingProperties[this.props.bondType].mode;
    var configModels = _.clone(this.props.configModels);
    var availableModes = [];
    var interfaces = this.props.interface.isBond() ? this.props.interface.getSlaveInterfaces() :
      [this.props.interface];
    _.each(interfaces, (ifc) => {
      configModels.interface = ifc;
      availableModes.push(_.reduce(modes, (result, modeSet) => {
        if (modeSet.condition &&
          !utils.evaluateExpression(modeSet.condition, configModels).value) return result;
        return result.concat(modeSet.values);
      }, []));
    });
    return _.intersection(...availableModes);
  },
  getBondPropertyValues(propertyName, value) {
    var bondType = this.props.bondType;
    return _.flatten(_.pluck(this.props.bondingProperties[bondType][propertyName], value));
  },
  updateBondProperties(options) {
    var bondProperties = _.cloneDeep(this.props.interface.get('bond_properties')) || {};
    bondProperties = _.extend(bondProperties, options);
    if (!this.isHashPolicyNeeded()) bondProperties = _.omit(bondProperties, 'xmit_hash_policy');
    if (!this.isLacpRateAvailable()) bondProperties = _.omit(bondProperties, 'lacp_rate');
    this.props.interface.set('bond_properties', bondProperties);
  },
  componentDidUpdate() {
    this.props.validate();
  },
  bondingChanged(name, value) {
    this.props.interface.set({checked: value});
  },
  bondingModeChanged(name, value) {
    this.props.interface.set({mode: value});
    this.updateBondProperties({mode: value});
    if (this.isHashPolicyNeeded()) {
      this.updateBondProperties({xmit_hash_policy: this.getBondPropertyValues('xmit_hash_policy',
        'values')[0]});
    }
    if (this.isLacpRateAvailable()) {
      this.updateBondProperties({lacp_rate: this.getBondPropertyValues('lacp_rate', 'values')[0]});
    }
  },
  onPolicyChange(name, value) {
    this.updateBondProperties({xmit_hash_policy: value});
  },
  onLacpChange(name, value) {
    this.updateBondProperties({lacp_rate: value});
  },
  getBondingOptions(bondingModes, attributeName) {
    return _.map(bondingModes, (mode) => {
      return (
        <option key={'option-' + mode} value={mode}>
          {i18n(ns + attributeName + '.' + mode.replace('.', '_'))}
        </option>
      );
    });
  },
  toggleOffloading() {
    var interfaceProperties = this.props.interface.get('interface_properties');
    var name = 'disable_offloading';
    this.onInterfacePropertiesChange(name, !interfaceProperties[name]);
  },
  makeOffloadingModesExcerpt() {
    var offloadingNS = 'cluster_page.nodes_tab.configure_interfaces.';
    var states = {
      true: i18n('common.enabled'),
      false: i18n('common.disabled'),
      null: i18n(offloadingNS + 'offloading_default')
    };
    var ifcModes = this.props.interface.get('offloading_modes');

    if (!ifcModes.length) {
      return states[!this.props.interface.get('interface_properties').disable_offloading];
    }
    if (_.uniq(_.pluck(ifcModes, 'state')).length === 1) {
      return states[ifcModes[0].state];
    }

    var lastState;
    var added = 0;
    var excerpt = [];
    _.each(ifcModes,
      (mode) => {
        if (!_.isNull(mode.state) && mode.state !== lastState) {
          lastState = mode.state;
          added++;
          excerpt.push((added > 1 ? ',' : '') + mode.name + ' ' + states[mode.state]);
        }
        // show no more than two modes in the button
        if (added === 2) return false;
      }
    );
    if (added < ifcModes.length) excerpt.push(', ...');
    return excerpt;
  },
  onInterfacePropertiesChange(name, value) {
    function convertToNullIfNaN(value) {
      var convertedValue = parseInt(value, 10);
      return _.isNaN(convertedValue) ? null : convertedValue;
    }
    if (_.contains(['mtu', 'sriov.sriov_numvfs'], name)) {
      value = convertToNullIfNaN(value);
    }
    var interfaceProperties = _.cloneDeep(this.props.interface.get('interface_properties') || {});
    _.set(interfaceProperties, name, value);
    this.props.interface.set('interface_properties', interfaceProperties);
  },
  renderConfigurableAttributes() {
    var ifc = this.props.interface;
    var ifcProperties = ifc.get('interface_properties');
    var errors = (this.props.errors || {}).interface_properties;
    var offloadingModes = ifc.get('offloading_modes') || [];
    return (
      <div className='properties-list'>
        <span className='property-item-container'>
          {i18n(ns + 'offloading_modes') + ':'}
          <button
            className='btn btn-link property-item'
            onClick={() => this.switchActiveSubtab('offloading_modes')}
          >
            {ifcProperties.disable_offloading ?
              i18n(ns + 'disable_offloading')
            :
              offloadingModes.length ?
                this.makeOffloadingModesExcerpt()
              :
                i18n(ns + 'default_offloading')
            }
          </button>
        </span>
        {_.map(ifcProperties, (propertyValue, propertyName) => {
          if (_.isPlainObject(propertyValue) && !propertyValue.available) return null;
          if (_.contains(this.renderedIfcProperties, propertyName)) {
            var classes = {
              'text-danger': _.has(errors, propertyName),
              'property-item-container': true,
              [propertyName]: true
            };
            var commonButtonProps = {
              className: 'btn btn-link property-item',
              onClick: () => this.switchActiveSubtab(propertyName)
            };
            //@TODO (morale): create some common component out of this
            switch (propertyName) {
              case 'sriov':
                return (
                  <span key={propertyName} className={utils.classNames(classes)}>
                    {i18n(ns + propertyName) + ':'}
                    <button {...commonButtonProps}>
                      {propertyValue.enabled ?
                        i18n('common.enabled')
                      :
                        i18n('common.disabled')
                      }
                    </button>
                  </span>
                );
              default:
                return (
                  <span key={propertyName} className={utils.classNames(classes)}>
                    {i18n(ns + propertyName) + ':'}
                    <button {...commonButtonProps}>
                      {propertyValue || i18n(ns + propertyName + '_placeholder')}
                    </button>
                  </span>
                );
            }
          }
        })}
      </div>
    );
  },
  getInterfacePropertyError() {
    return ((this.props.errors ||
      {}).interface_properties || {})[this.state.activeInterfaceSectionName] || null;
  },
  renderInterfaceSubtab() {
    var ifc = this.props.interface;
    var offloadingModes = ifc.get('offloading_modes') || [];
    var {locked} = this.props;
    var ifcProperties = ifc.get('interface_properties') || null;
    var errors = this.getInterfacePropertyError();
    switch (this.state.activeInterfaceSectionName) {
      case 'offloading_modes':
        return (
          <div>
            {offloadingModes.length ?
              <OffloadingModes interface={ifc} disabled={locked} />
            :
              <Input
                type='checkbox'
                label={i18n(ns + 'disable_offloading')}
                checked={ifcProperties.disable_offloading}
                name='disable_offloading'
                onChange={this.toggleOffloading}
                disabled={locked}
                wrapperClassName='toggle-offloading'
              />
            }
          </div>
        );
      case 'mtu':
        return (
          <Input
            type='number'
            min={42}
            max={65536}
            label={i18n(ns + 'mtu')}
            value={ifcProperties.mtu || ''}
            placeholder={i18n(ns + 'mtu_placeholder')}
            name='mtu'
            onChange={this.onInterfacePropertiesChange}
            disabled={locked}
            wrapperClassName='pull-left mtu-control'
            error={errors}
          />
        );
      case 'sriov':
        return this.renderSRIOV(errors);
    }
  },
  renderSRIOV(errors) {
    var ifc = this.props.interface;
    var interfaceProperties = ifc.get('interface_properties');
    var isSRIOVEnabled = interfaceProperties.sriov.enabled;
    var locked = this.props.locked || !interfaceProperties.sriov.available;
    return (
      <div className='sriov-panel'>
        <div className='description'>{i18n(ns + 'sriov_description')}</div>
        <Input
          type='checkbox'
          label={i18n('common.enabled')}
          checked={isSRIOVEnabled}
          name='sriov.enabled'
          onChange={this.onInterfacePropertiesChange}
          disabled={locked}
          wrapperClassName='sriov-control'
          error={errors && errors.common}
        />
        {isSRIOVEnabled &&
          [
            <Input
              key='sriov.sriov_numvfs'
              type='number'
              min={0}
              max={interfaceProperties.sriov.sriov_totalvfs}
              label={i18n(ns + 'virtual_functions')}
              value={interfaceProperties.sriov.sriov_numvfs}
              name='sriov.sriov_numvfs'
              onChange={this.onInterfacePropertiesChange}
              disabled={locked}
              wrapperClassName='sriov-virtual-functions'
              error={errors && errors.sriov_numvfs}
            />,
            <Input
              key='sriov.physnet'
              type='text'
              label={i18n(ns + 'physical_network')}
              value={interfaceProperties.sriov.physnet || ''}
              name='sriov.physnet'
              onChange={this.onInterfacePropertiesChange}
              disabled={locked}
              wrapperClassName='physnet'
              error={errors && errors.physnet}
            />
          ]
        }
      </div>
    );
  },
  switchActiveSubtab(subTabName) {
    var currentActiveTab = this.state.activeInterfaceSectionName;
    var isSameTab = currentActiveTab === subTabName;
    $(ReactDOM.findDOMNode(this.refs[this.props.interface.get('name')]))
      .collapse(isSameTab ? 'hide' : 'show');
    this.setState({activeInterfaceSectionName: isSameTab ? null : subTabName});
  },
  renderInterfaceProperties() {
    if (!this.props.interface.get('interface_properties')) return null;
    var name = this.props.interface.get('name');
    return (
      <div className='ifc-properties clearfix forms-box'>
        <div className='row'>
          <div className='col-xs-12'>
            {this.renderConfigurableAttributes()}
          </div>
        </div>
        <div
          className='row configuration-panel collapse'
          ref={name}
          id={name}
        >
          <div className='col-xs-12 interface-sub-tab'>
            {this.renderInterfaceSubtab()}
          </div>
        </div>
      </div>
    );
  },
  render() {
    var ifc = this.props.interface;
    var {cluster, locked} = this.props;
    var isBond = ifc.isBond();
    var availableBondingModes = isBond ? this.getAvailableBondingModes() : [];
    var networkConfiguration = cluster.get('networkConfiguration');
    var networks = networkConfiguration.get('networks');
    var networkingParameters = networkConfiguration.get('networking_parameters');
    var slaveInterfaces = ifc.getSlaveInterfaces();
    var assignedNetworks = ifc.get('assigned_networks');
    var connectionStatusClasses = (slave) => {
      var slaveDown = slave.get('state') === 'down';
      return {
        'ifc-connection-status': true,
        'ifc-online': !slaveDown,
        'ifc-offline': slaveDown
      };
    };
    var bondProperties = ifc.get('bond_properties');
    var bondingPossible = this.props.bondingAvailable && !locked;
    var networkErrors = (this.props.errors || {}).network_errors;
    return this.props.connectDropTarget(
      <div className='ifc-container'>
        <div
          className={utils.classNames({
            'ifc-inner-container': true,
            nodrag: networkErrors,
            over: this.props.isOver && this.props.canDrop,
            'has-changes': this.props.hasChanges,
            [ifc.get('name')]: true
          })}
        >
          <div className='ifc-header clearfix forms-box'>
            <div className={utils.classNames({
              'common-ifc-name pull-left': true,
              'no-checkbox': !bondingPossible
            })}>
              {bondingPossible ?
                <Input
                  type='checkbox'
                  label={ifc.get('name')}
                  onChange={this.bondingChanged}
                  checked={ifc.get('checked')}
                  disabled={locked}
                />
              :
                ifc.get('name')
              }
            </div>
            {isBond && [
              <Input
                key='bonding_mode'
                type='select'
                disabled={!bondingPossible}
                onChange={this.bondingModeChanged}
                value={this.getBondMode()}
                label={i18n(ns + 'bonding_mode')}
                children={this.getBondingOptions(availableBondingModes, 'bonding_modes')}
                wrapperClassName='pull-right'
              />,
              this.isHashPolicyNeeded() &&
                <Input
                  key='bonding_policy'
                  type='select'
                  value={bondProperties.xmit_hash_policy}
                  disabled={!bondingPossible}
                  onChange={this.onPolicyChange}
                  label={i18n(ns + 'bonding_policy')}
                  children={this.getBondingOptions(
                    this.getBondPropertyValues('xmit_hash_policy', 'values'),
                    'hash_policy'
                  )}
                  wrapperClassName='pull-right'
                />,
              this.isLacpRateAvailable() &&
                <Input
                  key='lacp_rate'
                  type='select'
                  value={bondProperties.lacp_rate}
                  disabled={!bondingPossible}
                  onChange={this.onLacpChange}
                  label={i18n(ns + 'lacp_rate')}
                  children={this.getBondingOptions(
                    this.getBondPropertyValues('lacp_rate', 'values'),
                    'lacp_rates'
                  )}
                  wrapperClassName='pull-right'
                />
            ]}
          </div>
          <div className='networks-block'>
            <div className='row'>
              <div className='col-xs-3'>
                <div className='pull-left'>
                  {_.map(slaveInterfaces, (slaveInterface, index) => {
                    return (
                      <div
                        key={'info-' + slaveInterface.get('name')}
                        className='ifc-info-block clearfix'
                        >
                        <div className='ifc-connection pull-left'>
                          <div
                            className={utils.classNames(connectionStatusClasses(slaveInterface))}
                          />
                        </div>
                        <div className='ifc-info pull-left'>
                          {isBond &&
                            <div>
                              {i18n(ns + 'name')}:
                              {' '}
                              <span className='ifc-name'>{this.props.interfaceNames[index]}</span>
                            </div>
                          }
                          {this.props.nodes.length === 1 &&
                            <div>{i18n(ns + 'mac')}: {slaveInterface.get('mac')}</div>
                          }
                          <div>
                            {i18n(ns + 'speed')}: {this.props.interfaceSpeeds[index].join(', ')}
                          </div>
                          {(bondingPossible && slaveInterfaces.length >= 3) &&
                            <button
                              className='btn btn-link'
                              onClick={_.partial(
                                    this.props.removeInterfaceFromBond,
                                    ifc.get('name'), slaveInterface.get('name')
                                  )}
                              >
                              {i18n('common.remove_button')}
                            </button>
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className='col-xs-9'>
                {!this.props.configurationTemplateExists &&
                  <div className='ifc-networks'>
                    {assignedNetworks.length ?
                      assignedNetworks.map((interfaceNetwork) => {
                        var network = interfaceNetwork.getFullNetwork(networks);
                        if (!network) return null;
                        return (
                          <DraggableNetwork
                            key={'network-' + network.id}
                            {... _.pick(this.props, ['locked', 'interface'])}
                            networkingParameters={networkingParameters}
                            interfaceNetwork={interfaceNetwork}
                            network={network}
                          />
                        );
                      })
                    :
                      i18n(ns + 'drag_and_drop_description')
                    }
                  </div>
                }
              </div>
            </div>
            {networkErrors && !!networkErrors.length &&
              <div className='ifc-error alert alert-danger'>
                {networkErrors.join(', ')}
              </div>
            }
          </div>
          {this.renderInterfaceProperties()}
        </div>
      </div>
    );
  }
});

var NodeInterfaceDropTarget = DropTarget(
  'network',
  NodeInterface.target,
  NodeInterface.collect
)(NodeInterface);

var Network = React.createClass({
  statics: {
    source: {
      beginDrag(props) {
        return {
          networkName: props.network.get('name'),
          interfaceName: props.interface.get('name')
        };
      },
      canDrag(props) {
        return !(props.locked || props.network.get('meta').unmovable);
      }
    },
    collect(connect, monitor) {
      return {
        connectDragSource: connect.dragSource(),
        isDragging: monitor.isDragging()
      };
    }
  },
  render() {
    var network = this.props.network;
    var interfaceNetwork = this.props.interfaceNetwork;
    var networkingParameters = this.props.networkingParameters;
    var classes = {
      'network-block pull-left': true,
      disabled: !this.constructor.source.canDrag(this.props),
      dragging: this.props.isDragging
    };
    var vlanRange = network.getVlanRange(networkingParameters);

    return this.props.connectDragSource(
      <div className={utils.classNames(classes)}>
        <div className='network-name'>
          {i18n(
            'network.' + interfaceNetwork.get('name'),
            {defaultValue: interfaceNetwork.get('name')}
          )}
        </div>
        {vlanRange &&
          <div className='vlan-id'>
            {i18n(ns + 'vlan_id', {count: _.uniq(vlanRange).length})}:
            {_.uniq(vlanRange).join('-')}
          </div>
        }
      </div>
    );
  }
});

var DraggableNetwork = DragSource('network', Network.source, Network.collect)(Network);

export default EditNodeInterfacesScreen;
