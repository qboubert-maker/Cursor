'use strict';
const fs = require('fs');
const path = require('path');
const ResEdit = require('resedit');

function stamp(exePath, icoPath, desc) {
    const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath));
    const res = ResEdit.NtExecutableResource.from(exe);
    const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath));
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
        res.entries,
        1,
        1033,
        iconFile.icons.map((item) => item.data)
    );
    const versions = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
    let vi = versions[0];
    if (!vi) {
        vi = ResEdit.Resource.VersionInfo.createEmpty();
        vi.lang = 1033;
    }
    vi.setStringValues({ lang: 1033, codepage: 1200 }, {
        FileDescription: desc,
        ProductName: desc,
        CompanyName: 'BlankDelay',
        LegalCopyright: 'BlankDelay',
        OriginalFilename: path.basename(exePath),
        InternalName: path.basename(exePath, '.exe')
    });
    vi.outputToResourceEntries(res.entries);
    res.outputResource(exe);
    fs.writeFileSync(exePath, Buffer.from(exe.generate()));
}

module.exports = { stamp };

if (require.main === module) {
    const icon = path.resolve(__dirname, '..', 'build', 'icon.ico');
    const targets = process.argv.slice(2);
    for (const t of targets) stamp(t, icon, path.basename(t, '.exe'));
}
