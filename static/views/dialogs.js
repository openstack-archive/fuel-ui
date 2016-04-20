/*
 * Copyright 2014 Mirantis, Inc.
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
import i18n from 'i18n';
import React from 'react';
import ReactDOM from 'react-dom';
import Backbone from 'backbone';
import utils from 'utils';
import models from 'models';
import dispatcher from 'dispatcher';
import {Input, ProgressBar, ProgressButton} from 'views/controls';
import NodeListScreen from 'views/cluster_page_tabs/nodes_tab_screens/node_list_screen';
import {backboneMixin, renamingMixin} from 'component_mixins';
import LinkedStateMixin from 'react-addons-linked-state-mixin';
import SettingSection from 'views/cluster_page_tabs/setting_section';

function getActiveDialog() {
  return app.dialog;
}

function setActiveDialog(dialog) {
  if (dialog) {
    app.dialog = dialog;
  } else {
    delete app.dialog;
  }
}

export var dialogMixin = {
  propTypes: {
    title: React.PropTypes.node,
    message: React.PropTypes.node,
    modalClass: React.PropTypes.node,
    error: React.PropTypes.bool,
    closeable: React.PropTypes.bool,
    keyboard: React.PropTypes.bool,
    background: React.PropTypes.bool,
    backdrop: React.PropTypes.oneOfType([
      React.PropTypes.string,
      React.PropTypes.bool
    ])
  },
  statics: {
    show(dialogOptions = {}, showOptions = {}) {
      var activeDialog = getActiveDialog();
      if (activeDialog) {
        var result = $.Deferred();
        if (showOptions.preventDuplicate && activeDialog.constructor === this) {
          result.reject();
        } else {
          $(ReactDOM.findDOMNode(activeDialog)).on('hidden.bs.modal', () => {
            this.show(dialogOptions).then(result.resolve, result.reject);
          });
        }
        return result;
      } else {
        return ReactDOM.render(
          React.createElement(this, dialogOptions),
          $('#modal-container')[0]
        ).getResult();
      }
    }
  },
  updateProps(partialProps) {
    var props;
    props = _.extend({}, this.props, partialProps);
    ReactDOM.render(
      React.createElement(this.constructor, props),
      ReactDOM.findDOMNode(this).parentNode
    );
  },
  getInitialState() {
    return {
      actionInProgress: false,
      result: $.Deferred()
    };
  },
  getResult() {
    return this.state.result;
  },
  componentDidMount() {
    setActiveDialog(this);
    Backbone.history.on('route', this.close, this);
    var $el = $(ReactDOM.findDOMNode(this));
    $el.on('hidden.bs.modal', this.handleHidden);
    $el.on('shown.bs.modal', () => $el.find('input:enabled:first').focus());
    $el.modal(_.defaults(
      {keyboard: false},
      _.pick(this.props, ['background', 'backdrop']),
      {background: true, backdrop: true}
    ));
  },
  rejectResult() {
    if (this.state.result.state() === 'pending') this.state.result.reject();
  },
  componentWillUnmount() {
    Backbone.history.off(null, null, this);
    $(ReactDOM.findDOMNode(this)).off('shown.bs.modal hidden.bs.modal');
    this.rejectResult();
    setActiveDialog(null);
  },
  handleHidden() {
    ReactDOM.unmountComponentAtNode(ReactDOM.findDOMNode(this).parentNode);
  },
  close() {
    $(ReactDOM.findDOMNode(this)).modal('hide');
    this.rejectResult();
  },
  closeOnLinkClick(e) {
    // close dialogs on click of any internal link inside it
    if (e.target.tagName === 'A' && !e.target.target && e.target.href) this.close();
  },
  closeOnEscapeKey(e) {
    if (
      this.props.keyboard !== false &&
      this.props.closeable !== false &&
      e.key === 'Escape'
    ) this.close();
    if (_.isFunction(this.onKeyDown)) this.onKeyDown(e);
  },
  showError(response, message) {
    var props = {error: true};
    props.message = utils.getResponseText(response) || message;
    this.updateProps(props);
  },
  renderImportantLabel() {
    return <span className='label label-danger'>{i18n('common.important')}</span>;
  },
  submitAction(options) {
    this.state.result.resolve(options);
    this.close();
  },
  render() {
    var classes = {'modal fade': true};
    classes[this.props.modalClass] = this.props.modalClass;
    return (
      <div
        className={utils.classNames(classes)}
        tabIndex='-1'
        onClick={this.closeOnLinkClick}
        onKeyDown={this.closeOnEscapeKey}
      >
        <div className='modal-dialog'>
          <div className='modal-content'>
            <div className='modal-header'>
              {this.props.closeable !== false &&
                <button type='button' className='close' aria-label='Close' onClick={this.close}>
                  <span aria-hidden='true'>&times;</span>
                </button>
              }
              <h4 className='modal-title'>
                {
                  this.props.title ||
                  this.state.title ||
                  (this.props.error ? i18n('dialog.error_dialog.title') : '')
                }
              </h4>
            </div>
            <div className='modal-body'>
              {this.props.error ?
                <div className='text-error'>
                  {this.props.message || i18n('dialog.error_dialog.server_error')}
                </div>
              : this.renderBody()}
            </div>
            <div className='modal-footer'>
              {this.renderFooter && !this.props.error ?
                this.renderFooter()
              :
                <button className='btn btn-default' onClick={this.close}>
                  {i18n('common.close_button')}
                </button>
              }
            </div>
          </div>
        </div>
      </div>
    );
  }
};

export var ErrorDialog = React.createClass({
  mixins: [dialogMixin],
  getDefaultProps() {
    return {error: true};
  }
});

export var NailgunUnavailabilityDialog = React.createClass({
  mixins: [dialogMixin],
  getDefaultProps() {
    return {
      title: i18n('dialog.nailgun_unavailability.title'),
      modalClass: 'nailgun-unavailability-dialog',
      closeable: false,
      keyboard: false,
      backdrop: false,
      retryDelayIntervals: [5, 10, 15, 20, 30, 60]
    };
  },
  getInitialState() {
    var initialDelay = this.props.retryDelayIntervals[0];
    return {
      currentDelay: initialDelay,
      currentDelayInterval: initialDelay
    };
  },
  componentWillMount() {
    this.startCountdown();
  },
  componentDidMount() {
    $(ReactDOM.findDOMNode(this)).on('shown.bs.modal', () => {
      return $(ReactDOM.findDOMNode(this.refs['retry-button'])).focus();
    });
  },
  startCountdown() {
    this.activeTimeout = _.delay(this.countdown, 1000);
  },
  stopCountdown() {
    if (this.activeTimeout) clearTimeout(this.activeTimeout);
    delete this.activeTimeout;
  },
  countdown() {
    var {currentDelay} = this.state;
    currentDelay--;
    if (!currentDelay) {
      this.setState({currentDelay, actionInProgress: true});
      this.reinitializeUI();
    } else {
      this.setState({currentDelay});
      this.startCountdown();
    }
  },
  reinitializeUI() {
    app.initialize().then(this.close, () => {
      var {retryDelayIntervals} = this.props;
      var nextDelay = retryDelayIntervals[
        retryDelayIntervals.indexOf(this.state.currentDelayInterval) + 1
      ] || _.last(retryDelayIntervals);
      _.defer(() => this.setState({
        actionInProgress: false,
        currentDelay: nextDelay,
        currentDelayInterval: nextDelay
      }, this.startCountdown));
    });
  },
  retryNow() {
    this.stopCountdown();
    this.setState({
      currentDelay: 0,
      currentDelayInterval: 0,
      actionInProgress: true
    });
    this.reinitializeUI();
  },
  renderBody() {
    return (
      <div>
        <p>
          {i18n('dialog.nailgun_unavailability.unavailability_message')}
          {' '}
          {this.state.currentDelay ?
            i18n(
              'dialog.nailgun_unavailability.retry_delay_message',
              {count: this.state.currentDelay}
            )
          :
            i18n('dialog.nailgun_unavailability.retrying')
          }
        </p>
        <p>
          {i18n('dialog.nailgun_unavailability.unavailability_reasons')}
        </p>
      </div>
    );
  },
  renderFooter() {
    return (
      <ProgressButton
        ref='retry-button'
        className='btn btn-success'
        onClick={this.retryNow}
        disabled={this.state.actionInProgress}
        progress={this.state.actionInProgress}
      >
        {i18n('dialog.nailgun_unavailability.retry_now')}
      </ProgressButton>
    );
  }
});

export var DiscardClusterChangesDialog = React.createClass({
  mixins: [dialogMixin],
  getInitialState() {
    var {cluster} = this.props;
    return {
      configModels: {
        cluster,
        settings: cluster.get('settings'),
        networking_parameters: cluster.get('networkConfiguration').get('networking_parameters'),
        version: app.version,
        release: cluster.get('release')
      }
    };
  },
  getDefaultProps() {
    return {
      title: i18n('dialog.discard_changes.title'),
      ns: 'dialog.discard_changes.'
    };
  },
  discardChanges() {
    this.setState({actionInProgress: true});
    var {cluster, changeName, ns} = this.props;

    if (changeName === 'changed_configuration') {
      var settings = cluster.get('settings');
      var currentSettings = _.cloneDeep(settings.attributes);
      var networkConfiguration = cluster.get('networkConfiguration');
      var currentNetworkConfiguration = _.cloneDeep(networkConfiguration.attributes);

      settings.updateAttributes(cluster.get('deployedSettings'), this.state.configModels);
      return settings.save(null, {patch: true, wait: true, validate: false})
        .then(
          () => cluster.get('networkConfiguration').fetch(),
          () => settings.updateAttributes(
              new models.Settings(currentSettings),
              this.state.configModels
            )
        )
        .then(() => {
          networkConfiguration.updateEditableAttributes(
            cluster.get('deployedNetworkConfiguration'),
            cluster.get('nodeNetworkGroups')
          );
          return networkConfiguration.save(null, {patch: true, wait: true, validate: false});
        })
        .then(
          () => this.close(),
          (response) => {
            networkConfiguration.updateEditableAttributes(
              new models.NetworkConfiguration(currentNetworkConfiguration),
              cluster.get('nodeNetworkGroups')
            );
            this.showError(response, i18n(ns + 'cant_discard'));
          }
        );
    } else {
      var nodes = new models.Nodes(this.props.nodes.map((node) => {
        if (node.get('pending_deletion')) {
          return {
            id: node.id,
            pending_deletion: false
          };
        }
        return {
          id: node.id,
          cluster_id: null,
          pending_addition: false,
          pending_roles: []
        };
      }));
      Backbone.sync('update', nodes)
        .then(() => cluster.fetchRelated('nodes'))
        .then(
          () => {
            dispatcher
            .trigger('updateNodeStats networkConfigurationUpdated labelsConfigurationUpdated');
            this.state.result.resolve();
            this.close();
          },
          (response) => this.showError(response, i18n(ns + 'cant_discard'))
        );
    }
  },
  renderBody() {
    var {nodes, changeName, ns} = this.props;
    var text = changeName === 'changed_configuration' ?
      i18n(ns + 'discard_environment_configuration')
    :
      i18n(ns + (nodes[0].get('pending_deletion') ? 'discard_deletion' : 'discard_addition'));
    return (
      <div className='text-danger'>
        {this.renderImportantLabel()}
        {text}
      </div>
    );
  },
  renderFooter() {
    return ([
      <button
        key='cancel'
        className='btn btn-default'
        onClick={this.close}
        disabled={this.state.actionInProgress}
      >
        {i18n('common.cancel_button')}
      </button>,
      <ProgressButton
        key='discard'
        className='btn btn-danger'
        disabled={this.state.actionInProgress}
        onClick={this.discardChanges}
        progress={this.state.actionInProgress}
      >
        {i18n('dialog.discard_changes.discard_button')}
      </ProgressButton>
    ]);
  }
});

export var DeployClusterDialog = React.createClass({
  mixins: [
    dialogMixin,
    // this is needed to somehow handle the case when
    // verification is in progress and user pressed Deploy
    backboneMixin({
      modelOrCollection(props) {
        return props.cluster.get('tasks');
      },
      renderOn: 'update change:status'
    })
  ],
  getDefaultProps() {
    return {title: i18n('dialog.deploy_cluster.title')};
  },
  ns: 'dialog.deploy_cluster.',
  deployCluster() {
    this.setState({actionInProgress: true});
    dispatcher.trigger('deploymentTasksUpdated');
    var task = new models.Task();
    task.save({}, {url: _.result(this.props.cluster, 'url') + '/changes', type: 'PUT'})
      .then(
        () => {
          this.close();
          dispatcher.trigger('deploymentTaskStarted');
        },
        this.showError
      );
  },
  renderBody() {
    var cluster = this.props.cluster;
    var warningNs = 'cluster_page.dashboard_tab.';
    return (
      <div className='display-changes-dialog'>
        {!cluster.needsRedeployment() && [
          this.props.isClusterConfigurationChanged &&
            <div className='text-warning' key='redeployment-alert'>
              <i className='glyphicon glyphicon-warning-sign' />
              <div className='instruction'>
                {i18n(warningNs + 'redeployment_alert')}
              </div>
            </div>,
          cluster.get('nodes').some({pending_addition: true}) &&
            <div key='new-nodes-alerts'>
              <div className='text-warning'>
                <i className='glyphicon glyphicon-warning-sign' />
                <div className='instruction'>
                  {i18n(warningNs + 'locked_settings_alert') + ' '}
                </div>
              </div>
              <div className='text-warning'>
                <i className='glyphicon glyphicon-warning-sign' />
                <div className='instruction'>
                  {i18n(warningNs + 'package_information')}
                </div>
              </div>
            </div>
        ]}
        <div className='confirmation-question'>
          {i18n(this.ns + 'are_you_sure_deploy')}
        </div>
      </div>
    );
  },
  renderFooter() {
    return ([
      <button
        key='cancel'
        className='btn btn-default'
        onClick={this.close}
        disabled={this.state.actionInProgress}
      >
        {i18n('common.cancel_button')}
      </button>,
      <ProgressButton
        key='deploy'
        className='btn start-deployment-btn btn-success'
        disabled={this.state.actionInProgress || this.state.isInvalid}
        onClick={this.deployCluster}
        progress={this.state.actionInProgress}
      >{i18n(this.ns + 'deploy')}</ProgressButton>
    ]);
  }
});

export var ProvisionNodesDialog = React.createClass({
  mixins: [dialogMixin],
  getDefaultProps() {
    return {title: i18n('dialog.provision_nodes.title')};
  },
  ns: 'dialog.provision_nodes.',
  provisionNodes() {
    this.setState({actionInProgress: true});
    dispatcher.trigger('deploymentTasksUpdated');
    var task = new models.Task();
    task
      .save({}, {
        url: _.result(this.props.cluster, 'url') + '/provision?nodes=' +
          this.props.nodeIds.join(','),
        type: 'PUT'
      })
      .then(
        () => {
          this.close();
          dispatcher.trigger('deploymentTaskStarted');
        },
        this.showError
      );
  },
  renderBody() {
    return (
      <div className='provision-nodes-dialog'>
        <div className='text-warning'>
          <i className='glyphicon glyphicon-warning-sign' />
          <div className='instruction'>
            {i18n(this.ns + 'locked_node_settings_alert') + ' '}
          </div>
        </div>
        <div className='text-warning'>
          <i className='glyphicon glyphicon-warning-sign' />
          <div className='instruction'>
            {i18n('cluster_page.dashboard_tab.package_information')}
          </div>
        </div>
        <div className='confirmation-question'>
          {i18n(this.ns + 'are_you_sure_provision')}
        </div>
      </div>
    );
  },
  renderFooter() {
    return ([
      <button
        key='cancel'
        className='btn btn-default'
        onClick={this.close}
        disabled={this.state.actionInProgress}
      >
        {i18n('common.cancel_button')}
      </button>,
      <ProgressButton
        key='provisioning'
        className='btn start-provision-btn btn-success'
        disabled={this.state.actionInProgress}
        onClick={this.provisionNodes}
        progress={this.state.actionInProgress}
      >
        {i18n(this.ns + 'start_provisioning', {count: this.props.nodeIds.length})}
      </ProgressButton>
    ]);
  }
});

export var DeployNodesDialog = React.createClass({
  mixins: [dialogMixin],
  getDefaultProps() {
    return {title: i18n('dialog.deploy_nodes.title')};
  },
  ns: 'dialog.deploy_nodes.',
  deployNodes() {
    this.setState({actionInProgress: true});
    dispatcher.trigger('deploymentTasksUpdated');
    var task = new models.Task();
    task.save({}, {
      url: _.result(this.props.cluster, 'url') + '/deploy?nodes=' + this.props.nodeIds.join(','),
      type: 'PUT'
    })
    .then(
      () => {
        this.close();
        dispatcher.trigger('deploymentTaskStarted');
      },
      this.showError
    );
  },
  renderBody() {
    return (
      <div className='deploy-nodes-dialog'>
        <div className='text-warning'>
          <i className='glyphicon glyphicon-warning-sign' />
          <div className='instruction'>
            {i18n(this.ns + 'locked_node_settings_alert') + ' '}
          </div>
        </div>
        <div className='text-warning'>
          <i className='glyphicon glyphicon-warning-sign' />
          <div className='instruction'>
            {i18n('cluster_page.dashboard_tab.package_information')}
          </div>
        </div>
        <div className='confirmation-question'>
          {i18n(this.ns + 'are_you_sure_deploy')}
        </div>
      </div>
    );
  },
  renderFooter() {
    return ([
      <button
        key='cancel'
        className='btn btn-default'
        onClick={this.close}
        disabled={this.state.actionInProgress}
      >
        {i18n('common.cancel_button')}
      </button>,
      <ProgressButton
        key='nodes-deployment'
        className='btn start-nodes-deployment-btn btn-success'
        disabled={this.state.actionInProgress}
        onClick={this.deployNodes}
        progress={this.state.actionInProgress}
      >
        {i18n(this.ns + 'start_deployment', {count: this.props.nodeIds.length})}
      </ProgressButton>
    ]);
  }
});

export var SelectNodesDialog = React.createClass({
  mixins: [dialogMixin],
  getInitialState() {
    var selectedNodeIds = {};
    _.each(this.props.selectedNodeIds, (id) => selectedNodeIds[id] = true);
    return {selectedNodeIds};
  },
  getDefaultProps() {
    return {
      title: i18n('dialog.select_nodes.title'),
      modalClass: 'select-nodes-dialog'
    };
  },
  ns: 'dialog.select_nodes.',
  selectNodes(ids = [], checked) {
    if (ids.length) {
      var nodeSelection = this.state.selectedNodeIds;
      _.each(ids, (id) => {
        if (checked) {
          nodeSelection[id] = true;
        } else {
          delete nodeSelection[id];
        }
      });
      this.setState({selectedNodeIds: nodeSelection});
    } else {
      this.setState({selectedNodeIds: {}});
    }
  },
  renderBody() {
    return <NodeListScreen
      statusesToFilter={models.Node.prototype.statuses}
      {...this.props}
      ref='screen'
      mode='list'
      selectedNodeIds={this.state.selectedNodeIds}
      selectNodes={this.selectNodes}
      sorters={_.without(models.Nodes.prototype.sorters, 'cluster')}
      defaultSorting={[{roles: 'asc'}]}
      filters={_.without(models.Nodes.prototype.filters, 'cluster')}
      defaultFilters={{roles: [], status: []}}
      showBatchActionButtons={false}
      showLabeManagementButton={false}
      showViewModeButtons={false}
      nodeActionsAvailable={false}
      viewMode='compact'
    />;
  },
  renderFooter() {
    var selectedNodesAmount = _.keys(this.state.selectedNodeIds).length;
    return ([
      <button
        key='cancel'
        className='btn btn-default'
        onClick={this.close}
        disabled={this.state.actionInProgress}
      >
        {i18n('common.cancel_button')}
      </button>,
      <ProgressButton
        key='proceed'
        className='btn btn-select-nodes btn-success'
        disabled={this.state.actionInProgress || !selectedNodesAmount}
        onClick={() => this.submitAction(_.keys(this.state.selectedNodeIds))}
        progress={this.state.actionInProgress}
      >
        {selectedNodesAmount ?
          i18n(this.ns + 'proceed', {count: selectedNodesAmount})
        :
          i18n(this.ns + 'can_not_proceed')
        }
      </ProgressButton>
    ]);
  }
});

export var ProvisionVMsDialog = React.createClass({
  mixins: [dialogMixin],
  getDefaultProps() {
    return {title: i18n('dialog.provision_vms.title')};
  },
  startProvisioning() {
    this.setState({actionInProgress: true});
    var task = new models.Task();
    task.save({}, {url: _.result(this.props.cluster, 'url') + '/spawn_vms', type: 'PUT'})
      .then(
        () => {
          this.close();
          dispatcher.trigger('deploymentTaskStarted');
        },
        (response) => this.showError(response, i18n('dialog.provision_vms.provision_vms_error'))
      );
  },
  renderBody() {
    var vmsCount = this.props.cluster.get('nodes').filter(
      (node) => node.get('pending_addition') && node.hasRole('virt')
    ).length;
    return i18n('dialog.provision_vms.text', {count: vmsCount});
  },
  renderFooter() {
    return ([
      <button
        key='cancel'
        className='btn btn-default'
        onClick={this.close}
        disabled={this.state.actionInProgress}
      >
        {i18n('common.cancel_button')}
      </button>,
      <ProgressButton
        key='provision'
        className='btn btn-success'
        disabled={this.state.actionInProgress}
        onClick={this.startProvisioning}
        progress={this.state.actionInProgress}
      >
        {i18n('common.start_button')}
      </ProgressButton>
    ]);
  }
});

export var StopDeploymentDialog = React.createClass({
  mixins: [dialogMixin],
  getInitialState() {
    return {
      title: i18n(this.props.ns + 'title')
    };
  },
  stopDeployment() {
    this.setState({actionInProgress: true});
    var task = new models.Task();
    var {cluster, ns} = this.props;
    task.save({}, {url: _.result(cluster, 'url') + '/stop_deployment', type: 'PUT'})
      .then(
        () => {
          this.close();
          dispatcher.trigger('deploymentTaskStarted');
        },
        (response) => {
          this.showError(response, i18n(ns + 'error.text'));
        }
      );
  },
  renderBody() {
    var {cluster, taskName, ns} = this.props;
    return (
      <div className='text-danger'>
        {this.renderImportantLabel()}
        {taskName === 'deploy' && cluster.get('nodes').some({status: 'provisioning'}) ?
          <span>
            {i18n(ns + 'provisioning_warning')}
            <br/><br/>
            {i18n(ns + 'redeployment_warning')}
          </span>
        :
          i18n(ns + 'text')
        }
      </div>
    );
  },
  renderFooter() {
    return ([
      <button
        key='cancel'
        className='btn btn-default'
        onClick={this.close}
        disabled={this.state.actionInProgress}
      >
        {i18n('common.cancel_button')}
      </button>,
      <ProgressButton
        key='deploy'
        className='btn stop-deployment-btn btn-danger'
        disabled={this.state.actionInProgress}
        onClick={this.stopDeployment}
        progress={this.state.actionInProgress}
      >
        {i18n('common.stop_button')}
      </ProgressButton>
    ]);
  }
});

export var RemoveClusterDialog = React.createClass({
  mixins: [dialogMixin],
  getInitialState() {
    return {confirmation: false};
  },
  getDefaultProps() {
    return {title: i18n('dialog.remove_cluster.title')};
  },
  removeCluster() {
    this.setState({actionInProgress: true});
    this.props.cluster
      .destroy({wait: true})
      .then(
        () => {
          this.close();
          dispatcher.trigger('updateNodeStats updateNotifications');
          app.navigate('#clusters', {trigger: true});
        },
        this.showError
      );
  },
  showConfirmationForm() {
    this.setState({confirmation: true});
  },
  getText() {
    var ns = 'dialog.remove_cluster.';
    var runningTask = this.props.cluster.task({active: true});
    if (runningTask) {
      if (runningTask.match({name: 'stop_deployment'})) {
        return i18n(ns + 'stop_deployment_is_running');
      }
      return i18n(ns + 'incomplete_actions_text');
    }
    if (this.props.cluster.get('nodes').length) {
      return i18n(ns + 'node_returned_text');
    }
    return i18n(ns + 'default_text');
  },
  renderBody() {
    var clusterName = this.props.cluster.get('name');
    return (
      <div>
        <div className='text-danger'>
          {this.renderImportantLabel()}
          {this.getText()}
        </div>
        {this.state.confirmation &&
          <div className='confirm-deletion-form'>
            {i18n('dialog.remove_cluster.enter_environment_name', {name: clusterName})}
            <Input
              type='text'
              disabled={this.state.actionInProgress}
              onChange={(name, value) => this.setState({confirmationError: value !== clusterName})}
              onPaste={(e) => e.preventDefault()}
              autoFocus
            />
          </div>
        }
      </div>
    );
  },
  renderFooter() {
    return ([
      <button
        key='cancel'
        className='btn btn-default'
        onClick={this.close}
        disabled={this.state.actionInProgress}
      >
        {i18n('common.cancel_button')}
      </button>,
      <ProgressButton
        key='remove'
        className='btn btn-danger remove-cluster-btn'
        disabled={this.state.actionInProgress || this.state.confirmation &&
          _.isUndefined(this.state.confirmationError) || this.state.confirmationError}
        onClick={this.props.cluster.get('status') === 'new' || this.state.confirmation ?
          this.removeCluster : this.showConfirmationForm}
        progress={this.state.actionInProgress}
      >
        {i18n('common.delete_button')}
      </ProgressButton>
    ]);
  }
});

// FIXME: the code below needs deduplication
// extra confirmation logic should be moved out to dialog mixin
export var ResetEnvironmentDialog = React.createClass({
  mixins: [dialogMixin],
  getInitialState() {
    return {confirmation: false};
  },
  getDefaultProps() {
    return {title: i18n('dialog.reset_environment.title')};
  },
  resetEnvironment() {
    this.setState({actionInProgress: true});
    dispatcher.trigger('deploymentTasksUpdated');
    var task = new models.Task();
    task.save({}, {url: _.result(this.props.cluster, 'url') + '/reset', type: 'PUT'})
      .then(
        () => {
          this.close();
          dispatcher.trigger('deploymentTaskStarted');
        },
        this.showError
      );
  },
  renderBody() {
    var clusterName = this.props.cluster.get('name');
    return (
      <div>
        <div className='text-danger'>
          {this.renderImportantLabel()}
          {i18n('dialog.reset_environment.text')}
        </div>
        {this.state.confirmation &&
          <div className='confirm-reset-form'>
            {i18n('dialog.reset_environment.enter_environment_name', {name: clusterName})}
            <Input
              type='text'
              name='name'
              disabled={this.state.actionInProgress}
              onChange={(name, value) => {
                this.setState({confirmationError: value !== clusterName});
              }}
              onPaste={(e) => e.preventDefault()}
              autoFocus
            />
          </div>
        }
      </div>
    );
  },
  showConfirmationForm() {
    this.setState({confirmation: true});
  },
  renderFooter() {
    return ([
      <button
        key='cancel'
        className='btn btn-default'
        disabled={this.state.actionInProgress}
        onClick={this.close}
      >
        {i18n('common.cancel_button')}
      </button>,
      <ProgressButton
        key='reset'
        className='btn btn-danger reset-environment-btn'
        disabled={this.state.actionInProgress || this.state.confirmation &&
         _.isUndefined(this.state.confirmationError) || this.state.confirmationError}
        onClick={this.state.confirmation ? this.resetEnvironment : this.showConfirmationForm}
        progress={this.state.actionInProgress}
      >
        {i18n('common.reset_button')}
      </ProgressButton>
    ]);
  }
});

export var ShowNodeInfoDialog = React.createClass({
  mixins: [
    dialogMixin,
    backboneMixin('node'),
    renamingMixin('hostname')
  ],
  renderableAttributes: [
    'cpu', 'disks', 'interfaces', 'memory', 'system', 'numa_topology', 'config', 'attributes'
  ],
  getDefaultProps() {
    return {
      modalClass: 'always-show-scrollbar',
      backdrop: 'static'
    };
  },
  getInitialState() {
    return {
      title: i18n('dialog.show_node.default_dialog_title'),
      VMsConf: null,
      VMsConfValidationError: null,
      hostnameChangingError: null,
      nodeAttributes: null,
      initialNodeAttributes: null,
      nodeAttributesError: null,
      savingError: null,
      configModels: null
    };
  },
  goToConfigurationScreen(url) {
    this.close();
    app.navigate(
      '#cluster/' + this.props.node.get('cluster') + '/nodes/' + url + '/' +
        utils.serializeTabOptions({nodes: this.props.node.id}),
      {trigger: true}
    );
  },
  showSummary(group) {
    var meta = this.props.node.get('meta');
    var summaryToString = (summary) =>
      _.keys(summary).sort().map((key) => summary[key] + ' x ' + key);
    var summaryFormatters = {
      system: () => [meta.system.manufacturer || '', meta.system.product || ''].join(' '),
      memory: () =>
        (
          _.isArray(meta.memory.devices) ?
            summaryToString(
              _.countBy(_.map(meta.memory.devices, 'size'), (value) => utils.showSize(value))
            )
          :
            []
        )
        .concat(utils.showSize(meta.memory.total) + ' ' + i18n('dialog.show_node.total'))
        .join(', '),
      disks: () => meta.disks.length + ' ' +
        i18n('dialog.show_node.drive', {count: meta.disks.length}) + ', ' +
        utils.showSize(_.reduce(_.map(meta.disks, 'size'), (sum, n) => sum + n, 0)) + ' ' +
        i18n('dialog.show_node.total'),
      cpu: () => summaryToString(
        _.countBy(_.map(meta.cpu.spec, 'frequency'), utils.showFrequency)
      ).join(', '),
      interfaces: () => summaryToString(
        _.countBy(_.map(meta.interfaces, 'current_speed'), utils.showBandwidth)
      ).join(', '),
      numa_topology: () => i18n('dialog.show_node.numa_nodes', {
        count: meta.numa_topology.numa_nodes.length
      }),
      default: () => ''
    };
    try {
      return (summaryFormatters[group] || summaryFormatters.default)();
    } catch (ignore) {}
  },
  showPropertyName(propertyName) {
    return String(propertyName).replace(/_/g, ' ');
  },
  showPropertyValue(group, name, value) {
    var valueFormatters = {
      size: utils.showSize,
      frequency: utils.showFrequency,
      max_speed: utils.showBandwidth,
      current_speed: utils.showBandwidth,
      maximum_capacity: group === 'memory' ? utils.showSize : _.identity,
      total: group === 'memory' ? utils.showSize : _.identity
    };
    try {
      value = valueFormatters[name](value);
    } catch (ignore) {}
    if (_.isBoolean(value)) return value ? i18n('common.true') : i18n('common.false');
    return !_.isNumber(value) && _.isEmpty(value) ? '\u00A0' : value;
  },
  componentDidUpdate() {
    this.assignAccordionEvents();
  },
  componentDidMount() {
    this.assignAccordionEvents();
    this.setDialogTitle();

    var {cluster, node} = this.props;

    if (node.get('pending_addition') && node.hasRole('virt')) {
      var VMsConfModel = new models.BaseModel();
      VMsConfModel.url = _.result(node, 'url') + '/vms_conf';
      this.updateProps({VMsConfModel: VMsConfModel});
      this.setState({actionInProgress: true});

      VMsConfModel.fetch()
        .then(null, () => $.Deferred().resolve())
        .then(() => {
          this.setState({
            actionInProgress: false,
            VMsConf: JSON.stringify(VMsConfModel.get('vms_conf'))
          });
        });
    }
    var nodeAttributesModel = new models.NodeAttributes();
    nodeAttributesModel.url = _.result(node, 'url') + '/attributes';
    this.setState({actionInProgress: true});

    nodeAttributesModel.fetch()
      .then(null, () => $.Deferred().resolve())
      .then(() => {
        var configModels = cluster && {
          settings: cluster.get('settings'),
          version: app.version
        };
        nodeAttributesModel.isValid({models: configModels});
        this.setState({
          actionInProgress: false,
          nodeAttributes: nodeAttributesModel,
          initialNodeAttributes: _.cloneDeep(nodeAttributesModel.attributes),
          nodeAttributesError: nodeAttributesModel.validationError,
          configModels
        });
      });
  },
  onNodeAttributesChange(groupName, name, value, nestedValue) {
    this.setState({nodeAttributesError: null});
    var attributesModel = this.state.nodeAttributes;
    name = utils.makePath(groupName, name, 'value');
    if (nestedValue) {
      name = utils.makePath(name, nestedValue);
    }
    attributesModel.set(name, value);
    attributesModel.isValid({models: this.state.configModels});
    this.setState({
      nodeAttributes: attributesModel,
      nodeAttributesError: attributesModel.validationError,
      savingError: null
    });
  },
  saveNodeAttributes() {
    this.setState({actionInProgress: true});
    this.state.nodeAttributes.save(null, {validate: false})
      .then(
        () => this.setState({
          initialNodeAttributes: _.cloneDeep(this.state.nodeAttributes.attributes),
          actionInProgress: false
        }),
        (response) => this.setState({
          savingError: utils.getResponseText(response),
          actionInProgress: false
        })
      );
  },
  cancelNodeAttributesChange() {
    var {nodeAttributes, initialNodeAttributes, configModels} = this.state;
    nodeAttributes.set(initialNodeAttributes);
    nodeAttributes.isValid({models: configModels});
    this.setState({
      nodeAttributes,
      nodeAttributesError: nodeAttributes.validationError,
      savingError: null,
      key: _.now()
    });
  },
  hasNodeAttributesChanges() {
    return !_.isEqual(
      this.state.nodeAttributes.attributes,
      this.state.initialNodeAttributes
    );
  },
  setDialogTitle() {
    var name = this.props.node && this.props.node.get('name');
    if (name && name !== this.state.title) this.setState({title: name});
  },
  assignAccordionEvents() {
    $('.panel-collapse', ReactDOM.findDOMNode(this))
      .on('show.bs.collapse', (e) => $(e.currentTarget).siblings('.panel-heading').find('i')
        .removeClass('glyphicon-plus-dark').addClass('glyphicon-minus-dark'))
      .on('hide.bs.collapse', (e) => $(e.currentTarget).siblings('.panel-heading').find('i')
        .removeClass('glyphicon-minus-dark').addClass('glyphicon-plus-dark'))
      .on('hidden.bs.collapse', (e) => e.stopPropagation());
  },
  toggle(groupIndex) {
    $(ReactDOM.findDOMNode(this.refs['togglable_' + groupIndex])).collapse('toggle');
  },
  onVMsConfChange() {
    this.setState({VMsConfValidationError: null});
  },
  saveVMsConf() {
    var parsedVMsConf;
    try {
      parsedVMsConf = JSON.parse(this.refs['vms-config'].getInputDOMNode().value);
    } catch (e) {
      this.setState({VMsConfValidationError: i18n('node_details.invalid_vms_conf_msg')});
    }
    if (parsedVMsConf) {
      this.setState({actionInProgress: true});
      this.props.VMsConfModel.save({vms_conf: parsedVMsConf}, {method: 'PUT'})
        .then(
          () => {
            this.setState({actionInProgress: false});
          },
          (response) => {
            this.setState({
              VMsConfValidationError: utils.getResponseText(response),
              actionInProgress: false
            });
          }
        );
    }
  },
  startHostnameRenaming(e) {
    this.setState({hostnameChangingError: null});
    this.startRenaming(e);
  },
  onHostnameInputKeydown(e) {
    this.setState({hostnameChangingError: null});
    if (e.key === 'Enter') {
      this.setState({actionInProgress: true});
      var hostname = _.trim(this.refs.hostname.getInputDOMNode().value);
      (hostname !== this.props.node.get('hostname') ?
        this.props.node.save({hostname: hostname}, {patch: true, wait: true}) :
        $.Deferred().resolve()
      )
      .then(
        this.endRenaming,
        (response) => {
          this.setState({
            hostnameChangingError: utils.getResponseText(response),
            actionInProgress: false
          });
          this.refs.hostname.getInputDOMNode().focus();
        }
      );
    } else if (e.key === 'Escape') {
      this.endRenaming();
      e.stopPropagation();
      ReactDOM.findDOMNode(this).focus();
    }
  },
  getNodeIp(networkName) {
    var node = this.props.node;
    var networkData = _.find(node.get('network_data'), {name: networkName});
    if ((networkData || {}).ip) return networkData.ip.split('/')[0];
    var interfaceData = _.find(node.get('meta').interfaces, {name: (networkData || {}).dev});
    return (interfaceData || {}).ip || i18n('common.not_available');
  },
  renderNodeSummary() {
    var {cluster, node, nodeNetworkGroup} = this.props;
    return (
      <div className='row node-summary'>
        <div className='col-xs-6'>
          {node.get('cluster') && cluster &&
            <div><strong>{i18n('dialog.show_node.cluster')}: </strong>
              {cluster.get('name')}
            </div>
          }
          <div><strong>{i18n('dialog.show_node.manufacturer_label')}: </strong>
            {node.get('manufacturer') || i18n('common.not_available')}
          </div>
          {nodeNetworkGroup &&
            <div>
              <strong>{i18n('dialog.show_node.node_network_group')}: </strong>
              {nodeNetworkGroup.get('name')}
            </div>
          }
          <div><strong>{i18n('dialog.show_node.fqdn_label')}: </strong>
            {
              (node.get('meta').system || {}).fqdn ||
              node.get('fqdn') ||
              i18n('common.not_available')
            }
          </div>
        </div>
        <div className='col-xs-6'>
          {node.get('cluster') &&
            <div>
              <div className='management-ip'>
                <strong>{i18n('dialog.show_node.management_ip')}: </strong>
                {this.getNodeIp('management')}
              </div>
              <div className='public-ip'>
                <strong>{i18n('dialog.show_node.public_ip')}: </strong>
                {this.getNodeIp('public')}
              </div>
            </div>
          }
          <div><strong>{i18n('dialog.show_node.mac_address_label')}: </strong>
            {node.get('mac') || i18n('common.not_available')}
          </div>
          <div className='change-hostname'>
            <strong>{i18n('dialog.show_node.hostname_label')}: </strong>
            {this.state.isRenaming ?
              <Input
                ref='hostname'
                type='text'
                defaultValue={node.get('hostname')}
                inputClassName={'input-sm'}
                error={this.state.hostnameChangingError}
                disabled={this.state.actionInProgress}
                onKeyDown={this.onHostnameInputKeydown}
                selectOnFocus
                autoFocus
              />
            :
              <span>
                <span className='node-hostname'>
                  {node.get('hostname') || i18n('common.not_available')}
                </span>
                {(node.get('pending_addition') || !node.get('cluster')) &&
                  <button
                    className='btn-link glyphicon glyphicon-pencil'
                    onClick={this.startHostnameRenaming}
                  />
                }
              </span>
            }
          </div>
        </div>
      </div>
    );
  },
  renderVMConfig() {
    return (
      <div className='panel-body'>
        <div className='vms-config'>
          <Input
            ref='vms-config'
            type='textarea'
            label={i18n('node_details.vms_config_msg')}
            error={this.state.VMsConfValidationError}
            onChange={this.onVMsConfChange}
            defaultValue={this.state.VMsConf}
          />
          <button
            className='btn btn-success'
            onClick={this.saveVMsConf}
            disabled={this.state.VMsConfValidationError ||
              this.state.actionInProgress}
            >
            {i18n('common.save_settings_button')}
          </button>
        </div>
      </div>
    );
  },
  renderNodeAttributes() {
    var {node, cluster} = this.props;
    var {
      nodeAttributes, initialNodeAttributes, nodeAttributesError, savingError,
      actionInProgress, configModels
    } = this.state;

    var isLocked = !node.get('pending_addition') || actionInProgress;

    var attributes = _.chain(_.keys(nodeAttributes.attributes))
      .filter(
        (sectionName) => !nodeAttributes.checkRestrictions(
          configModels,
          'hide',
          nodeAttributes.get(sectionName).metadata
        ).result
      )
      .sortBy(
        (sectionName) => nodeAttributes.get(utils.makePath(sectionName, 'metadata', 'weight'))
      )
      .map(
        (sectionName) => {
          var metadata = nodeAttributes.get(utils.makePath(sectionName, 'metadata'));
          var settingsToDisplay = _.compact(_.map(nodeAttributes.attributes[sectionName],
            (setting, settingName) => {
              if (nodeAttributes.isSettingVisible(setting, settingName, configModels)) {
                return settingName;
              }
            }));
          return (
            <SettingSection
              {... {sectionName, settingsToDisplay, cluster, configModels}}
              key={sectionName}
              initialAttributes={initialNodeAttributes}
              onChange={_.partial(this.onNodeAttributesChange, sectionName)}
              settings={nodeAttributes}
              locked={
                isLocked ||
                nodeAttributes.checkRestrictions(configModels, 'disable', metadata).result
              }
              checkRestrictions={_.partial(nodeAttributes.checkRestrictions, configModels)}
            />
          );
        }
      )
      .value();

    return (
      <div className='panel-body' key={this.state.key}>
        <div className='node-attributes'>
          {attributes}
          {savingError &&
            <div className='alert alert-danger'>
              <h4>{i18n('node_details.save_error')}</h4>
              {savingError}
            </div>
          }
          <div className='btn-group'>
            <button
              className='btn btn-default discard-changes'
              onClick={this.cancelNodeAttributesChange}
              disabled={
                !this.hasNodeAttributesChanges() ||
                this.state.actionInProgress
              }
            >
              {i18n('common.cancel_changes_button')}
            </button>
            <ProgressButton
              className='btn btn-success apply-changes'
              onClick={this.saveNodeAttributes}
              disabled={
                !_.isNull(nodeAttributesError) ||
                !this.hasNodeAttributesChanges() ||
                this.state.actionInProgress
              }
              progress={this.state.actionInProgress}
            >
              {i18n('common.save_settings_button')}
            </ProgressButton>
          </div>
        </div>
      </div>
    );
  },
  renderNUMATopology() {
    return (
      <div className='panel-body'>
        <div className='numa-topology'>
          {_.map(this.props.node.get('meta').numa_topology.numa_nodes, (numaNode, index) => {
            return (
              <div
                className='nested-object'
                key={'subentries_numa-' + index}
              >
                {this.renderNodeInfo('id', numaNode.id)}
                {!!numaNode.cpus && this.renderNodeInfo('cpu_id', numaNode.cpus.join(', '))}
                {this.renderNodeInfo('memory', utils.showSize(numaNode.memory))}
              </div>
            );
          })}
        </div>
      </div>
    );
  },
  getNodeDetailsGroups() {
    var groups = _.keys(this.props.node.get('meta'));

    var {nodeAttributes, configModels} = this.state;
    if (nodeAttributes && configModels) {
      if (_.some(_.keys(nodeAttributes.attributes), (sectionName) => {
        return !nodeAttributes.checkRestrictions(
          configModels,
          'hide',
          nodeAttributes.get(sectionName).metadata
        ).result;
      })) {
        groups.push('attributes');
      }
    }
    if (this.state.VMsConf) groups.push('config');
    return _.intersection(this.renderableAttributes, groups);
  },
  renderGroupContent(group, groupIndex) {
    var sortOrder = {
      disks: ['name', 'model', 'size'],
      interfaces: ['name', 'mac', 'state', 'ip', 'netmask', 'current_speed', 'max_speed',
        'driver', 'bus_info']
    };
    var groupEntries = this.props.node.get('meta')[group];
    if (group === 'interfaces' || group === 'disks') {
      groupEntries = _.sortBy(groupEntries, 'name');
    }
    var subEntries = _.isPlainObject(groupEntries) ?
      _.find(_.values(groupEntries), _.isArray) : [];
    switch (group) {
      case 'config':
        return this.renderVMConfig();
      case 'numa_topology':
        return this.renderNUMATopology();
      case 'attributes':
        return this.renderNodeAttributes();
      default:
        return (
          <div className='panel-body'>
            {_.isArray(groupEntries) &&
              <div>
                {_.map(groupEntries, (entry, entryIndex) => {
                  return (
                    <div className='nested-object' key={'entry_' + groupIndex + entryIndex}>
                      {_.map(utils.sortEntryProperties(entry, sortOrder[group]),
                        (propertyName) => {
                          if (
                            !_.isPlainObject(entry[propertyName]) &&
                            !_.isArray(entry[propertyName])
                          ) {
                            return this.renderNodeInfo(
                              propertyName,
                              this.showPropertyValue(group, propertyName, entry[propertyName])
                            );
                          }
                        }
                      )}
                    </div>
                  );
                })}
              </div>
            }
            {_.isPlainObject(groupEntries) &&
              <div>
                {_.map(groupEntries, (propertyValue, propertyName) => {
                  if (
                    !_.isPlainObject(propertyValue) &&
                    !_.isArray(propertyValue) &&
                    !_.isNumber(propertyName)
                  ) {
                    return this.renderNodeInfo(
                      propertyName,
                      this.showPropertyValue(group, propertyName, propertyValue)
                    );
                  }
                })}
                {!_.isEmpty(subEntries) &&
                  <div>
                    {_.map(subEntries, (subentry, subentrysIndex) => {
                      return (
                        <div
                          className='nested-object'
                          key={'subentries_' + groupIndex + subentrysIndex}
                          >
                          {_.map(utils.sortEntryProperties(subentry), (propertyName) => {
                            return this.renderNodeInfo(
                              propertyName,
                              this.showPropertyValue(
                                group, propertyName, subentry[propertyName]
                              )
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                }
              </div>
            }
            {
              !_.isPlainObject(groupEntries) &&
              !_.isArray(groupEntries) &&
              !_.isUndefined(groupEntries) &&
                <div>{groupEntries}</div>
            }
          </div>
        );
    }
  },
  renderNodeHardware() {
    var groups = this.getNodeDetailsGroups();
    return (
      <div className='panel-group' id='accordion' role='tablist' aria-multiselectable='true'>
        {_.map(groups, (group, groupIndex) => {
          return (
            <div className='panel panel-default' key={group + groupIndex}>
              <div
                className='panel-heading'
                role='tab'
                id={'heading' + group}
                onClick={() => this.toggle(groupIndex)}
              >
                <div className='panel-title'>
                  <div
                    data-parent='#accordion'
                    aria-expanded='true'
                    aria-controls={'body' + group}
                  >
                    <strong>{i18n('node_details.' + group, {defaultValue: group})}</strong>
                    {this.showSummary(group)}
                    <i className='glyphicon glyphicon-plus-dark pull-right' />
                  </div>
                </div>
              </div>
              <div
                className='panel-collapse collapse'
                role='tabpanel'
                aria-labelledby={'heading' + group}
                ref={'togglable_' + groupIndex}
              >
                {this.renderGroupContent(group, groupIndex)}
              </div>
            </div>
          );
        })}
      </div>
    );
  },
  renderBody() {
    if (!this.props.node.get('meta')) return <ProgressBar />;
    return (
      <div className='node-details-popup enable-selection'>
        {this.renderNodeSummary()}
        {this.renderNodeHardware()}
      </div>
    );
  },
  renderFooter() {
    return (
      <div>
        {this.props.renderActionButtons && this.props.node.get('cluster') &&
          <div className='btn-group' role='group'>
            <button
              className='btn btn-default btn-edit-disks'
              onClick={_.partial(this.goToConfigurationScreen, 'disks')}
            >
              {i18n('dialog.show_node.disk_configuration' +
                (this.props.node.areDisksConfigurable() ? '_action' : ''))}
            </button>
            <button
              className='btn btn-default btn-edit-networks'
              onClick={_.partial(this.goToConfigurationScreen, 'interfaces')}
            >
              {i18n('dialog.show_node.network_configuration' +
                (this.props.node.areInterfacesConfigurable() ? '_action' : ''))}
            </button>
          </div>
        }
        <div className='btn-group' role='group'>
          <button
            className='btn btn-default'
            onClick={this.close}
          >
            {i18n('common.close_button')}
          </button>
        </div>
      </div>
    );
  },
  renderNodeInfo(name, value) {
    return (
      <div key={name + value} className='node-details-row'>
        <label>
          {i18n('dialog.show_node.' + name, {defaultValue: this.showPropertyName(name)})}
        </label>
        {value}
      </div>
    );
  }
});

export var DiscardSettingsChangesDialog = React.createClass({
  mixins: [dialogMixin],
  getDefaultProps() {
    return {title: i18n('dialog.dismiss_settings.title')};
  },
  proceedWith(method, action = true) {
    this.setState({actionInProgress: action});
    return $.when(method ? method() : $.Deferred().resolve())
      .then(this.state.result.resolve)
      .then(
        this.close,
        _.partial(this.showError, null, i18n('dialog.dismiss_settings.saving_failed_message'))
        );
  },
  discard() {
    return this.proceedWith(this.props.revertChanges, 'discard_changes');
  },
  save() {
    return this.proceedWith(this.props.applyChanges, 'save_changes');
  },
  getMessage() {
    if (this.props.isDiscardingPossible === false) return 'no_discard_message';
    if (this.props.isSavingPossible === false) return 'no_saving_message';
    return 'default_message';
  },
  renderBody() {
    return (
      <div className='text-danger dismiss-settings-dialog'>
        {this.renderImportantLabel()}
        {i18n('dialog.dismiss_settings.' + this.getMessage())}
      </div>
    );
  },
  renderFooter() {
    var buttons = [
      <button
        key='stay'
        className='btn btn-default'
        onClick={this.close}
      >
        {i18n('dialog.dismiss_settings.stay_button')}
      </button>,
      <ProgressButton
        key='leave'
        className='btn btn-danger proceed-btn'
        onClick={this.discard}
        disabled={this.state.actionInProgress || this.props.isDiscardingPossible === false}
        progress={this.state.actionInProgress === 'discard_changes'}
      >
        {i18n('dialog.dismiss_settings.leave_button')}
      </ProgressButton>,
      <ProgressButton
        key='save'
        className='btn btn-success'
        onClick={this.save}
        disabled={this.state.actionInProgress || this.props.isSavingPossible === false}
        progress={this.state.actionInProgress === 'save_changes'}
      >
        {i18n('dialog.dismiss_settings.apply_and_proceed_button')}
      </ProgressButton>
    ];
    return buttons;
  }
});

export var RemoveOfflineNodeDialog = React.createClass({
  mixins: [dialogMixin],
  getDefaultProps() {
    return {
      title: i18n('dialog.remove_node.title'),
      defaultMessage: i18n('dialog.remove_node.default_message')
    };
  },
  renderBody() {
    return (
      <div className='text-danger'>
        {this.renderImportantLabel()}
        {this.props.defaultMessage}
      </div>
    );
  },
  renderFooter() {
    return [
      <button key='close' className='btn btn-default' onClick={this.close}>
        {i18n('common.cancel_button')}
      </button>,
      <ProgressButton
        key='remove'
        className='btn btn-danger btn-delete'
        onClick={this.submitAction}
        progress={this.state.actionInProgress}
      >
        {i18n('cluster_page.nodes_tab.node.remove')}
      </ProgressButton>
    ];
  }
});

export var DeleteNodesDialog = React.createClass({
  mixins: [dialogMixin],
  getDefaultProps() {
    return {title: i18n('dialog.delete_nodes.title')};
  },
  renderBody() {
    var ns = 'dialog.delete_nodes.';
    var {nodes} = this.props;
    var addedNodes = nodes.filter({pending_addition: true});
    return (
      <div className='text-danger'>
        {this.renderImportantLabel()}
        {i18n(ns + 'common_message', {count: this.props.nodes.length})}
        <br/>
        {!!addedNodes.length &&
          i18n(ns + 'added_nodes_message', {count: addedNodes.length})
        }
        {' '}
        {!!(nodes.length - addedNodes.length) &&
          i18n(ns + 'deployed_nodes_message', {count: nodes.length - addedNodes.length})
        }
      </div>
    );
  },
  renderFooter() {
    return [
      <button
        key='cancel'
        className='btn btn-default'
        onClick={this.close}>{i18n('common.cancel_button')}
      </button>,
      <ProgressButton
        key='delete'
        className='btn btn-danger btn-delete'
        onClick={this.deleteNodes}
        disabled={this.state.actionInProgress}
        progress={this.state.actionInProgress}
      >
        {i18n('common.delete_button')}
      </ProgressButton>
    ];
  },
  deleteNodes() {
    this.setState({actionInProgress: true});
    var nodes = new models.Nodes(this.props.nodes.map((node) => {
      if (node.get('pending_addition')) {
        return {
          id: node.id,
          cluster_id: null,
          pending_addition: false,
          pending_roles: []
        };
      }
      return {
        id: node.id,
        pending_deletion: true
      };
    }));
    Backbone.sync('update', nodes)
      .then(() => this.props.cluster.fetchRelated('nodes'))
      .then(
        () => {
          dispatcher.trigger('updateNodeStats networkConfigurationUpdated ' +
            'labelsConfigurationUpdated');
          this.state.result.resolve();
          this.close();
        },
        (response) => this.showError(response, i18n('cluster_page.nodes_tab.node_deletion_error.' +
            'node_deletion_warning'))
      );
  }
});

export var ChangePasswordDialog = React.createClass({
  mixins: [
    dialogMixin,
    LinkedStateMixin
  ],
  getDefaultProps() {
    return {
      title: i18n('dialog.change_password.title'),
      modalClass: 'change-password'
    };
  },
  getInitialState() {
    return {
      currentPassword: '',
      confirmationPassword: '',
      newPassword: '',
      validationError: false
    };
  },
  getError(name) {
    var ns = 'dialog.change_password.';
    if (name === 'currentPassword' && this.state.validationError) {
      return i18n(ns + 'wrong_current_password');
    }
    if (this.state.newPassword !== this.state.confirmationPassword) {
      if (name === 'confirmationPassword') return i18n(ns + 'new_password_mismatch');
      if (name === 'newPassword') return '';
    }
    return null;
  },
  renderBody() {
    var ns = 'dialog.change_password.';
    var fields = ['currentPassword', 'newPassword', 'confirmationPassword'];
    var translationKeys = ['current_password', 'new_password', 'confirm_new_password'];
    return (
      <div className='forms-box'>
        <div className='alert alert-warning'>
          {i18n(ns + 'changing_password_warning')}
        </div>
        {_.map(fields, (name, index) => {
          return <Input
            key={name}
            name={name}
            ref={name}
            type='password'
            label={i18n(ns + translationKeys[index])}
            maxLength='50'
            onChange={_.partial(this.handleChange, (name === 'currentPassword'))}
            onKeyDown={this.handleKeyDown}
            disabled={this.state.actionInProgress}
            toggleable={name === 'currentPassword'}
            defaultValue={this.state[name]}
            error={this.getError(name)}
          />;
        })}
      </div>
    );
  },
  renderFooter() {
    return [
      <button
        key='cancel'
        className='btn btn-default'
        onClick={this.close}
        disabled={this.state.actionInProgress}
      >
        {i18n('common.cancel_button')}
      </button>,
      <ProgressButton
        key='apply'
        className='btn btn-success'
        onClick={this.changePassword}
        disabled={this.state.actionInProgress || !this.isPasswordChangeAvailable()}
        progress={this.state.actionInProgress}
      >
        {i18n('common.apply_button')}
      </ProgressButton>
    ];
  },
  isPasswordChangeAvailable() {
    return this.state.newPassword.length && !this.state.validationError &&
      (this.state.newPassword === this.state.confirmationPassword);
  },
  handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.changePassword();
    }
    if (e.key === ' ') {
      e.preventDefault();
      return false;
    }
  },
  handleChange(clearError, name, value) {
    var newState = {};
    newState[name] = value.trim();
    if (clearError) {
      newState.validationError = false;
    }
    this.setState(newState);
  },
  changePassword() {
    if (this.isPasswordChangeAvailable()) {
      var keystoneClient = app.keystoneClient;
      this.setState({actionInProgress: true});
      keystoneClient.changePassword(this.state.currentPassword, this.state.newPassword)
        .then(
          () => {
            dispatcher.trigger(this.state.newPassword === keystoneClient.DEFAULT_PASSWORD ?
              'showDefaultPasswordWarning' : 'hideDefaultPasswordWarning');
            app.user.set({token: keystoneClient.token});
            this.close();
          },
          () => {
            this.setState({validationError: true, actionInProgress: false});
            $(this.refs.currentPassword.getInputDOMNode()).focus();
          }
        );
    }
  }
});

export var CreateNodeNetworkGroupDialog = React.createClass({
  mixins: [dialogMixin],
  getDefaultProps() {
    return {
      title: i18n('cluster_page.network_tab.add_node_network_group'),
      ns: 'cluster_page.network_tab.'
    };
  },
  getInitialState() {
    return {
      error: null
    };
  },
  renderBody() {
    return (
      <div className='node-network-group-creation'>
        <Input
          name='node-network-group-name'
          type='text'
          label={i18n(this.props.ns + 'node_network_group_name')}
          onChange={this.onChange}
          error={this.state.error}
          wrapperClassName='node-group-name'
          inputClassName='node-group-input-name'
          maxLength='50'
          disabled={this.state.actionInProgress}
          autoFocus
        />
      </div>
    );
  },
  renderFooter() {
    return [
      <button
        key='cancel'
        className='btn btn-default'
        onClick={this.close}
        disabled={this.state.actionInProgress}
      >
        {i18n('common.cancel_button')}
      </button>,
      <ProgressButton
        key='apply'
        className='btn btn-success'
        onClick={this.createNodeNetworkGroup}
        disabled={this.state.actionInProgress || this.state.error}
        progress={this.state.actionInProgress}
      >
        {i18n(this.props.ns + 'add')}
      </ProgressButton>
    ];
  },
  onKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.createNodeNetworkGroup();
    }
  },
  onChange(name, value) {
    this.setState({
      error: null,
      name: value
    });
  },
  createNodeNetworkGroup() {
    var error = (new models.NodeNetworkGroup()).validate({
      name: this.state.name,
      nodeNetworkGroups: this.props.nodeNetworkGroups
    });
    if (error) {
      this.setState({error: error});
    } else {
      this.setState({actionInProgress: true});
      (new models.NodeNetworkGroup({
        cluster_id: this.props.clusterId,
        name: this.state.name
      }))
        .save(null, {validate: false})
        .then(
          this.submitAction,
          (response) => {
            this.close();
            utils.showErrorDialog({
              title: i18n(this.props.ns + 'node_network_group_creation_error'),
              response: response
            });
          }
        );
    }
  }
});

export var RemoveNodeNetworkGroupDialog = React.createClass({
  mixins: [dialogMixin],
  getDefaultProps() {
    return {title: i18n('dialog.remove_node_network_group.title')};
  },
  renderBody() {
    return (
      <div>
        <div className='text-danger'>
          {this.renderImportantLabel()}
          {this.props.showUnsavedChangesWarning &&
            (i18n('dialog.remove_node_network_group.unsaved_changes_alert') + ' ')
          }
          {i18n('dialog.remove_node_network_group.confirmation')}
        </div>
      </div>
    );
  },
  renderFooter() {
    return ([
      <button key='cancel' className='btn btn-default' onClick={this.close}>
        {i18n('common.cancel_button')}
      </button>,
      <ProgressButton
        key='remove'
        className='btn btn-danger remove-cluster-btn'
        onClick={this.submitAction}
        progress={this.state.actionInProgress}
      >
        {i18n('common.delete_button')}
      </ProgressButton>
    ]);
  }
});
