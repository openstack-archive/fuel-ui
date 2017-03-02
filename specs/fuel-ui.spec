%define name fuel-ui
%{!?version: %define version 11.0.0}
%{!?release: %define release 1}

Summary: Nailgun UI package
Name: %{name}
Version: %{version}
Release: %{release}
Source0: %{name}-%{version}.tar.gz
License: Apache
Group: Development/Libraries
BuildRoot: %{_tmppath}/%{name}-%{version}-buildroot
Prefix: %{_prefix}
BuildArch: noarch

BuildRequires: nodejs
BuildRequires: nodejs-nailgun

%description
Nailgun UI package

%prep
%setup -cq -n %{name}-%{version}

cp -pr /opt/nodejs-nailgun/lib/node_modules %{_builddir}/%{name}-%{version}/node_modules

%build
./node_modules/.bin/gulp build --static-dir=compressed_static
rm -rf static
mv compressed_static static

%install
mkdir -p %{buildroot}/usr/share/nailgun
cp -pr %{_builddir}/%{name}-%{version}/static %{buildroot}/usr/share/nailgun/

%clean
rm -rf $RPM_BUILD_ROOT

%files
%defattr(0755,root,root)
/usr/share/nailgun
