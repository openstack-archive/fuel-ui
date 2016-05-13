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
import i18n from 'i18n';
import React from 'react';
import utils from 'utils';
import models from 'models';
import {Tooltip} from 'views/controls';

var PluginsPage = React.createClass({
  statics: {
    title: i18n('plugins_page.title'),
    navbarActiveElement: 'plugins',
    breadcrumbsPath: [['home', '#'], 'plugins'],
    fetchData() {
      var releases = app.releases;
      var plugins = new models.Plugins();
      var availableVersions = {};
      return $.when(
        plugins.fetch()
          .then(() => {
            return $.when(...plugins.map((plugin) => {
              var links = new models.PluginLinks();
              links.url = _.result(plugin, 'url') + '/links';
              plugin.set({links: links});
              return links.fetch();
            }));
          }),
        releases.fetch({cache: true})
          .then(() => {
            releases.each((release) => {
              availableVersions[
                release.get('operating_system').toLowerCase() + '-' + release.get('version')
              ] = true;
            });
          })
      )
      .then(() => ({plugins, availableVersions}));
    }
  },
  getDefaultProps() {
    return {
      details: [
        'version',
        'description',
        'homepage',
        'authors',
        'licenses',
        'releases',
        'links'
      ]
    };
  },
  processPluginData(plugin, attribute) {
    var data = plugin.get(attribute);
    if (attribute === 'releases') {
      return _.map(_.groupBy(data, 'os'), (osReleases, osName) =>
        <div key={osName}>
          {i18n('plugins_page.' + osName) + ': '}
          {_.map(osReleases, 'version').join(', ')}
        </div>
      );
    }
    if (attribute === 'homepage') {
      return <span dangerouslySetInnerHTML={{__html: utils.composeLink(data)}} />;
    }
    if (attribute === 'links') {
      return data.map((link) =>
        <div key={link.get('url')} className='plugin-link'>
          <a href={link.get('url')} target='_blank'>{link.get('title')}</a>
          {link.get('description')}
        </div>
      );
    }
    if (_.isArray(data)) return data.join(', ');
    return data;
  },
  renderPlugin(plugin, index) {
    var unsupported = !_.some(
      plugin.get('releases'),
      (release) => this.props.availableVersions[release.os + '-' + release.version]
    );
    var classes = {
      plugin: true,
      unsupported
    };
    return (
      <div key={index} className={utils.classNames(classes)}>
        <div className='row'>
          <div className='col-xs-2' />
          <h3 className='col-xs-10'>
            {unsupported &&
              <Tooltip text={i18n('plugins_page.unsupported_plugin')}>
                <span className='glyphicon glyphicon-warning-sign' aria-hidden='true' />
              </Tooltip>
            }
            {plugin.get('title')}
          </h3>
        </div>
        {_.map(this.props.details, (attribute) => {
          var data = this.processPluginData(plugin, attribute);
          if (data.length) {
            return (
              <div className='row' key={attribute}>
                <div className='col-xs-2 detail-title text-right'>
                  {i18n('plugins_page.' + attribute)}:
                </div>
                <div className='col-xs-10'>{data}</div>
              </div>
            );
          }
        })}
      </div>
    );
  },
  render() {
    var links = {
      catalog: 'http://stackalytics.com/report/driverlog?project_id=openstack%2Ffuel'
    };
    return (
      <div className='plugins-page'>
        <div className='page-title'>
          <h1 className='title'>{i18n('plugins_page.title')}</h1>
        </div>
        <div className='content-box'>
          <div className='row'>
            <div className='col-xs-12'>
              {this.props.plugins.map(this.renderPlugin)}
              <div className={utils.classNames({
                'plugin-page-links': !!this.props.plugins.length,
                'text-center': true
              })}>
                {!this.props.plugins.length && i18n('plugins_page.no_plugins')}{' '}
                <span>
                  {i18n('plugins_page.more_info')}{' '}
                  <a href={links.catalog} target='_blank'>
                    {i18n('plugins_page.plugins_catalog')}
                  </a>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
});

export default PluginsPage;
