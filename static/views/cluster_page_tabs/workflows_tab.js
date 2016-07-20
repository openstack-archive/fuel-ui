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
import _ from 'underscore';
import i18n from 'i18n';
import React from 'react';
import models from 'models';
import utils from 'utils';
import {backboneMixin} from 'component_mixins';
import {Input} from 'views/controls';
import {DeleteGraphDialog} from 'views/dialogs';

var WorkflowsTab;

WorkflowsTab = React.createClass({
  mixins: [
    backboneMixin({
      modelOrCollection: (props) => props.cluster.get('deploymentGraphs'),
      renderOn: 'update change'
    })
  ],
  statics: {
    breadcrumbsPath() {
      return [
        [i18n('cluster_page.tabs.workflows'), null, {active: true}]
      ];
    },
    fetchData({cluster}) {
      var deploymentGraphs = cluster.get('deploymentGraphs');
      //var plugins = new models.Plugins();
      return deploymentGraphs.fetch({cache: true})
        .then(() => {
          // if (_.some(deploymentGraphs.models, (graph) =>
          //  _.find(graph.get('relations'), (relation) => relation.model === 'plugin'))) {
          //   return plugins.fetch();
          // }
          return Promise.resolve();
        });
        //.then(() => ({plugins));
    }
  },
  getDefaultProps() {
    return {
      graph: new models.DeploymentGraph()
    };
  },
  uploadGraph() {
    var {cluster} = this.props;
    var deploymentGraph = new models.DeploymentGraph();
    deploymentGraph.url = '/api/clusters/' + cluster.id + '/deployment_graphs/' + this.state.type;
    deploymentGraph.set({
      name: this.state.name,
      type: '5555',
      tasks: this.state.file ? JSON.parse(this.state.file.content) : []
    });
    deploymentGraph.save()
     .then(
      () => {
        cluster.get('deploymentGraphs').fetch();
      },
      (response) => {
        this.setState({error: utils.getResponseText(response)});
      }
    );
  },
  getInitialState() {
    // todo rewrite on new models.deploymentGraph
    return {
      type: null,
      file: null,
      error: false
    };
  },
  onChange(name, value) {
    this.setState({
      [name]: value,
      error: false
    });
  },
  render() {
    var {cluster, plugins} = this.props;
    var {name, type, file, error} = this.state;
    var ns = 'cluster_page.workflows_tab.';
    //rewrite according the some relation possible
    var deploymentGraphs = cluster.get('deploymentGraphs').groupBy(
      (graph) => graph.get('relations')[0].model
    );
    return (
      <div className='graphs'>
        <div className='row'>
          <div className='title col-xs-12'>
            {i18n(ns + 'title')}
          </div>
          <div className='wrapper col-xs-12'>
            <table className='table table-bordered table-striped'>
              <thead>
                <tr>
                  <th>{i18n(ns + 'graph_name_header')}</th>
                  <th>{i18n(ns + 'graph_type_header')}</th>
                  <th />
                  <th />
                </tr>
              </thead>
              <tbody>
                {_.map(deploymentGraphs, (graphs, graphLevel) => {
                  return [
                    <tr key='subheader' className='subheader'>
                      <td colSpan='4'>
                        {i18n(ns + graphLevel + '_graph_level', {
                          plugin: graphLevel === 'plugin' &&
                            plugins.get(graphs.at(0).get('relations').model_id).get('name')
                        })}
                      </td>
                    </tr>
                  ].concat(
                    _.map(graphs, (graph) => {
                      var blob = new Blob([JSON.stringify(graph.get('tasks'))],
                        {type: 'application/json'});
                      var url = URL.createObjectURL(blob);

                      // TODO: Fix the [0]
                      var type = graph.get('relations')[0].type;
                      return <tr key={graph.id}>
                        <td>{graph.get('name')}</td>
                        <td>{type}</td>
                        <td>
                          {
                          // FIXME(jaranovich): there is no handler to download tasks JSON of graph
                          // of 'cluster' level (#1605639)
                          //graphLevel !== 'cluster' &&
                          }
                          <a
                            href={url}
                            download='graph.json'
                            target='_blank'>
                            {i18n(ns + 'download_graph')}
                          </a>
                        </td>
                        <td>
                          {graphLevel === 'cluster' && type !== 'default' &&
                            <button
                              className='btn btn-link'
                              onClick={() => DeleteGraphDialog.show({cluster, graphId: graph.id})}
                            >
                              {i18n(ns + 'delete_graph')}
                            </button>
                          }
                        </td>
                      </tr>;
                    })
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className='forms-box row'>
          <div className='title col-xs-12'>
            Upload new graph
          </div>
          {error &&
            <div className='alert alert-danger col-xs-12'>
              {error}
            </div>
          }
          <div className='col-xs-3'>
            <Input
              type='text'
              label='Name'
              name='name'
              value={name}
              onChange={this.onChange}
            />
          </div>
          <div className='col-xs-3'>
            <Input
              type='text'
              label='Type'
              name='type'
              value={type}
              onChange={this.onChange}
            />
          </div>
          <div className='col-xs-4'>
            <Input
              type='file'
              label='file'
              name='file'
              value={file}
              onChange={this.onChange}
            />
          </div>
          <div className='col-xs-2'>
            <button
              onClick={this.uploadGraph}>
              upload
            </button>
          </div>
        </div>
      </div>
    );
  }
});

export default WorkflowsTab;
