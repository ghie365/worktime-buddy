# Changelog

All notable changes to **WorkTime Buddy** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-11-22

### Added
- **Dedicated ⚙️ Settings Tab**: 5-tab bottom navigation including comprehensive settings management.
- **Dynamic Compensation Mode**: Toggle between **Monthly Salary** and **Hourly Rate** for either job independently.
- **Customizable Job Profiles**: Editable job titles (Sr. Sysadmin, L3 Linux Engineer, or custom) and primary currencies (IDR / USD).
- **Exchange Rate Configuration**: Custom USD → IDR exchange rate.
- **Custom Work Schedule**: Set local shift hours (start/end) to dynamically recalculate the overlap timeline.
- **Optimal Sync Window**: Dedicated highlight card showing best hours for real-time meetings with US team.
- **Data Management**: Export all tracked sessions as JSON backup; clear data with confirmation dialog.
- **App Version Indicator**: Version `v1.1.0 (Build 2)` displayed inside the app.
- **Automated Android Versioning**: CI pipeline now synchronizes Android `versionCode` and `versionName`, generating `WorkTime-Buddy-v1.1.0.apk`.
- **Automated GitHub Releases**: Pushing git tags automatically publishes releases with the APK attached.

### Changed
- **Redesigned Timezones UI**: Modern 2-row / 2-column clock cards preventing text squishing and overflow on mobile portrait screens.
- **Improved 24-Hour Timeline**: Clean 4-hour tick marks (`00, 04, 08, 12, 16, 20, 24`) with high-contrast color bands.
- **Mobile Scroll Padding**: Generous bottom padding (`96px`) ensuring the Meeting Planner and settings cards are never cut off by the navigation bar.

---

## [1.0.0] - 2026-11-22

### Added
- Initial release of **WorkTime Buddy**.
- Dual-job time tracking (Sysadmin + L3 Engineer) with live timer and manual session entry.
- Monthly earnings overview with currency conversion.
- Live world clocks for Jakarta (WIB) and US timezones (ET, CT, MT, PT).
- 24-hour working hours overlap visualizer and meeting planner.
- PWA manifest and service worker for offline Android support.
- Automated Android APK build pipeline via GitHub Actions.
