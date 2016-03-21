%define name fuel-ui
%{!?version: %define version 10.0.0}
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

cp -pr /usr/lib/node_modules %{_builddir}/%{name}-%{version}/node_modules
cp -pr /usr/lib/node_modules/.bin %{_builddir}/node_modules/

%build
cd %{_builddir}/%{name}-%{version} && %{_builddir}/%{name}-%{version}/node_modules/.bin/gulp build --static-dir=compressed_static
[ -n %{_builddir} ] && rm -rf %{_builddir}/%{name}-%{version}/static
mv %{_builddir}/%{name}-%{version}/compressed_static %{_builddir}/%{name}-%{version}/static

%install
mkdir -p %{buildroot}/usr/share/nailgun
cp -pr %{_builddir}/%{name}-%{version}/static %{buildroot}/usr/share/nailgun/

%clean
rm -rf $RPM_BUILD_ROOT

%files
%defattr(0755,root,root)
/usr/share/nailgun


