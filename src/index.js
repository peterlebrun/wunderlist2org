const fetch = require('node-fetch');
const fs = require('fs');

const apiUrlBase = 'https://a.wunderlist.com/api/v1/';
const listsUrl = apiUrlBase + 'lists';
const tasksUrl = apiUrlBase + 'tasks';
const notesUrl = apiUrlBase + 'notes';
const foldersUrl = apiUrlBase + 'folders';

const method = 'GET';
const headers = {
    'X-Access-Token': process.env.XACCESSTOKEN,
    'X-Client-Id': process.env.XCLIENTID,
    'Content-Type': 'application/json',
};

const folders = {};
const lists = {};
const amalgam = {};

const fetchEm = (url, store) => {
    // method, headers are global here
    return fetch(url, {method, headers})
        .then(response => response.json())
        .then(items => {
            items.forEach(i => {
                store[i.id] = i;
            });
        });
};

fetchEm(listsUrl, lists)
// Populate task/note data for all lists
    .then(() => {
        let f = id => {
            let param = '?list_id=' + id;
            let tUrl = tasksUrl + param;
            let nUrl = notesUrl + param;

            return Promise.all([
                fetch(tUrl, {method, headers})
                    .then(response => response.json())
                    .then(tasks => lists[id]['tasks'] = tasks),
                fetch(nUrl, {method, headers})
                    .then(response => response.json())
                    .then(notes => {
                        lists[id]['notes'] = {};
                        notes.forEach(note => {
                            lists[id]['notes'][note.task_id] = note.content;
                        });
                    }),
            ]);
        };
        return Promise.all(Object.keys(lists).map(id => f(id)));
    })
// Populate info about folders
    .then(() => fetchEm(foldersUrl, folders))
    .then(() => {
        Object.keys(folders).forEach(folderId => {
            amalgam[folderId] = {
                id: folderId,
                title: folders[folderId].title,
                lists: {},
            };

            folders[folderId].list_ids.forEach(listId => {
                if (!(listId in lists)) {
                    return;
                }

                amalgam[folderId].lists[listId] = {
                    id: listId,
                    title: lists[listId].title,
                    tasks: {},
                };

                lists[listId].tasks.forEach(t => {
                    amalgam[folderId].lists[listId].tasks[t.id] = {
                        id: t.id,
                        title: t.title,
                    };
                    let note = lists[listId].notes[t.id];
                    if (note !== undefined) {
                        amalgam[folderId].lists[listId].tasks[t.id]['note'] = note;
                    }
                });

                delete lists[listId];
            });
        });

        noFolderString = 'No Folder';
        amalgam[noFolderString] = {
            id: -1,
            title: noFolderString,
            lists: {},
        };

        // @TODO This is currently repeating itself
        Object.keys(lists).forEach(listId => {
            amalgam[noFolderString].lists[listId] = {
                id: listId,
                title: lists[listId].title,
                tasks: {},
            };

            lists[listId].tasks.forEach(t => {
                amalgam[noFolderString].lists[listId].tasks[t.id] = {
                    id: t.id,
                    title: t.title,
                };
                let note = lists[listId].notes[t.id];
                if (note !== undefined) {
                    amalgam[noFolderString].lists[listId].tasks[t.id]['note'] = note;
                }
            });

            delete lists[listId];
        });

        const outFile = './wunderlist.org';
        if (fs.existsSync(outFile)) {
            fs.unlinkSync(outFile);
        }
        let write = (text, lvl) => {
            if (lvl < 4) {
                fs.appendFileSync(outFile, '*'.repeat(lvl) + ' ' + text + '\n');
            } else {
                fs.appendFileSync(outFile, '    - ' + text + '\n');
            }
        };

        // Write to org file
        Object.keys(amalgam).forEach(folderId => {
            write(amalgam[folderId].title, 1);
            Object.keys(amalgam[folderId].lists).forEach(listId => {
                write(amalgam[folderId].lists[listId].title, 2);

                Object.keys(amalgam[folderId].lists[listId].tasks).forEach(taskId => {
                    let task = amalgam[folderId].lists[listId].tasks[taskId];
                    write('TODO ' + task.title, 3);
                    if (task.note !== undefined) {
                        write(
                            task.note
                                .replace(/\*/gi, ' ')
                                .replace(/\n\n/gi, '\n')
                                .replace(/\n/gi, '\n    - '),
                            4);
                    }
                });
            });
        });
    });
