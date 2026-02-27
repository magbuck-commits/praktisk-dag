// Praktisk Dag App - Simpel version
const form = document.getElementById('activity-form');
const input = document.getElementById('activity-input');
const list = document.getElementById('activity-list');

let aktiviteter = [];

function renderList() {
    list.innerHTML = '';
    aktiviteter.forEach((aktivitet, idx) => {
        const li = document.createElement('li');
        li.textContent = aktivitet;
        const btn = document.createElement('button');
        btn.textContent = 'Slet';
        btn.onclick = () => {
            aktiviteter.splice(idx, 1);
            renderList();
        };
        li.appendChild(btn);
        list.appendChild(li);
    });
}

form.onsubmit = function(e) {
    e.preventDefault();
    if (input.value.trim()) {
        aktiviteter.push(input.value.trim());
        input.value = '';
        renderList();
    }
};

renderList();