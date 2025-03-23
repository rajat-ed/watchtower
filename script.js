const subjects = ['English', 'Nepali', 'Math', 'Science', 'Samajik', 'Computer', 'Optional-1', 'Gap'];
const grades = [4, 5, 6, 7, 8, 9, 10];
const sections = ['A', 'B', 'C'];
const classes = grades.flatMap(grade => sections.map(section => `${grade}${section}`));
const maxDays = 14;

let teacherData = JSON.parse(localStorage.getItem('teacherData')) || [];
let examRoutine = JSON.parse(localStorage.getItem('examRoutine')) || [];
let chartLowerGrades = null;
let chartUpperGrades = null;
let schedule = null;

document.addEventListener('DOMContentLoaded', () => {
    initTeacherTable();
    initExamTable();
    addNavigationListeners();
    loadSavedData();
});

function initTeacherTable() {
    const table = document.getElementById('teacherTable');
    let header = '<tr><th>Subject</th>';
    grades.forEach(grade => header += `<th>Grade ${grade}</th>`);
    header += '</tr>';
    
    let rows = '';
    subjects.filter(subject => subject !== 'Gap').forEach(subject => {
        rows += `<tr><td>${subject}</td>`;
        grades.forEach(grade => rows += `<td><input type="text" data-grade="${grade}" data-subject="${subject}"></td>`);
        rows += '</tr>';
    });
    
    table.innerHTML = header + rows;
}

function initExamTable() {
    const table = document.getElementById('examTable');
    let header = '<tr><th>Grade</th>';
    for (let day = 1; day <= maxDays; day++) {
        header += `<th>Day ${day}</th>`;
    }
    header += '</tr>';
    
    let rows = '';
    grades.forEach(grade => {
        rows += `<tr><td>Grade ${grade}</td>`;
        for (let day = 1; day <= maxDays; day++) {
            rows += `<td><select data-grade="${grade}" data-day="${day}">
                <option value="" selected></option>
                ${subjects.map(subject => `<option value="${subject}">${subject}</option>`).join('')}
            </select></td>`;
        }
        rows += '</tr>';
    });
    
    table.innerHTML = header + rows;
}

function addNavigationListeners() {
    const inputs = document.querySelectorAll('input[type="text"], select');
    inputs.forEach(input => {
        input.addEventListener('keydown', (e) => {
            const table = input.closest('table');
            const row = input.closest('tr');
            const cell = input.closest('td');
            const rowIndex = Array.from(row.parentNode.children).indexOf(row);
            const cellIndex = Array.from(row.children).indexOf(cell);
            const rows = table.querySelectorAll('tr');
            const cols = row.querySelectorAll('td');

            switch (e.key) {
                case 'ArrowUp':
                    if (rowIndex > 1) rows[rowIndex - 1].children[cellIndex].querySelector('input, select').focus();
                    break;
                case 'ArrowDown':
                    if (rowIndex < rows.length - 1) rows[rowIndex + 1].children[cellIndex].querySelector('input, select').focus();
                    break;
                case 'ArrowLeft':
                    if (cellIndex > 1) cols[cellIndex - 1].querySelector('input, select').focus();
                    break;
                case 'ArrowRight':
                    if (cellIndex < cols.length - 1) cols[cellIndex + 1].querySelector('input, select').focus();
                    break;
            }
        });
    });
}

function loadSavedData() {
    const teacherInputs = document.querySelectorAll('#teacherTable input');
    teacherInputs.forEach(input => {
        const grade = parseInt(input.dataset.grade);
        const subject = input.dataset.subject;
        const teacher = teacherData.find(t => t.grade === grade && t.subjects.includes(subject));
        if (teacher) input.value = teacher.name;
    });

    const examSelects = document.querySelectorAll('#examTable select');
    examSelects.forEach(select => {
        const grade = parseInt(select.dataset.grade);
        const day = parseInt(select.dataset.day);
        const exam = examRoutine.find(e => e.grade === grade && e.day === day && e.hall === `${grade}A`);
        if (exam) select.value = exam.subject;
    });
}

function submitTeacherData() {
    const inputs = document.querySelectorAll('#teacherTable input');
    teacherData = [];
    
    inputs.forEach(input => {
        const teacherName = input.value.trim();
        if (teacherName) {
            const grade = parseInt(input.dataset.grade);
            const subject = input.dataset.subject;
            teacherData.push({ name: teacherName, grade, subjects: [subject] });
        }
    });
    
    localStorage.setItem('teacherData', JSON.stringify(teacherData));
    alert('Teacher data submitted successfully!');
}

function submitExamRoutine() {
    const selects = document.querySelectorAll('#examTable select');
    examRoutine = [];
    
    selects.forEach(select => {
        const subject = select.value;
        if (subject && subject !== 'Gap') {
            const grade = parseInt(select.dataset.grade);
            const day = parseInt(select.dataset.day);
            sections.forEach(section => {
                examRoutine.push({ day, subject, grade, hall: `${grade}${section}` });
            });
        }
    });
    
    localStorage.setItem('examRoutine', JSON.stringify(examRoutine));
    alert('Exam routine submitted successfully!');
}

function clearData() {
    if (confirm('Are you sure you want to clear all data?')) {
        teacherData = [];
        examRoutine = [];
        schedule = null;
        localStorage.removeItem('teacherData');
        localStorage.removeItem('examRoutine');
        document.querySelectorAll('#teacherTable input').forEach(input => input.value = '');
        document.querySelectorAll('#examTable select').forEach(select => select.value = '');
        document.getElementById('scheduleOutput').innerHTML = '';
        if (chartLowerGrades) chartLowerGrades.destroy();
        if (chartUpperGrades) chartUpperGrades.destroy();
        alert('All data cleared!');
    }
}

class Scheduler {
    constructor(examRoutine, teachers) {
        this.examRoutine = examRoutine;
        this.teachers = teachers;
        this.schedule = {};
        this.teacherCooldown = new Map();
        this.teacherDuties = new Map();
        this.teacherSubjectDays = new Map();
        this.teacherAssignedHall = new Map();
    }

    generateSchedule() {
        const days = [...new Set(this.examRoutine.map(exam => exam.day))].sort((a, b) => a - b);
        
        this.teachers.forEach(teacher => {
            this.teacherDuties.set(teacher.name, 0);
            this.teacherSubjectDays.set(teacher.name, 0);
        });

        for (let day = 1; day <= maxDays; day++) {
            this.schedule[day] = [];
            this.teacherAssignedHall.clear();
            const dayExams = this.examRoutine.filter(exam => exam.day === day);
            const availableTeachers = this.getAvailableTeachers(day);

            dayExams.sort((a, b) => {
                const aTeachers = this.teachers.filter(t => t.subjects.includes(a.subject)).length;
                const bTeachers = this.teachers.filter(t => t.subjects.includes(b.subject)).length;
                return aTeachers - bTeachers;
            });

            dayExams.forEach((exam, index) => {
                const firstHalf = this.assignInvigilator(exam, availableTeachers, day, 'first');
                const secondHalf = this.assignInvigilator(exam, availableTeachers, day, 'second', firstHalf);
                
                this.schedule[day].push({
                    serial: index + 1,
                    hall: exam.hall,
                    grade: exam.grade,
                    subject: exam.subject,
                    firstHalf: firstHalf,
                    secondHalf: secondHalf,
                    conflicts: this.checkConflicts(firstHalf, secondHalf)
                });

                this.teachers.forEach(teacher => {
                    if (teacher.subjects.includes(exam.subject) && teacher.grade === exam.grade) {
                        this.teacherSubjectDays.set(teacher.name, day);
                    }
                });
            });

            this.ensureMinimumDuty(day, availableTeachers);
        }

        this.displayDutyCharts();
        return this.schedule;
    }

    getAvailableTeachers(day) {
        return this.teachers.filter(teacher => {
            const cooldown = this.teacherCooldown.get(teacher.name) || { half: 0, full: 0 };
            return cooldown.full < day;
        });
    }

    assignInvigilator(exam, availableTeachers, day, half, previousHalf = null) {
        let candidates = availableTeachers.filter(t => 
            t.grade === exam.grade && 
            !this.isTeacherAssigned(t.name, day, exam.hall)
        );

        const subjectTeacher = candidates.find(t => 
            t.subjects.includes(exam.subject) && t.grade === exam.grade
        );

        if (subjectTeacher) {
            if (half === 'first') {
                this.teacherDuties.set(subjectTeacher.name, (this.teacherDuties.get(subjectTeacher.name) || 0) + 1);
                this.teacherCooldown.set(subjectTeacher.name, { half: day + 2, full: day + 3 });
                this.teacherAssignedHall.set(subjectTeacher.name, exam.hall);
                return subjectTeacher.name;
            } else if (half === 'second' && previousHalf === subjectTeacher.name) {
                this.teacherDuties.set(subjectTeacher.name, (this.teacherDuties.get(subjectTeacher.name) || 0) + 1);
                return subjectTeacher.name;
            }
        }

        candidates = candidates.filter(t => !this.teacherAssignedHall.has(t.name));

        candidates.sort((a, b) => {
            const aIsComputer = a.subjects.includes('Computer') && a.grade >= 4 && a.grade <= 8;
            const bIsComputer = b.subjects.includes('Computer') && a.grade >= 4 && a.grade <= 8;
            if (aIsComputer && !bIsComputer) return 1;
            if (!aIsComputer && bIsComputer) return -1;
            return (this.teacherDuties.get(a.name) || 0) - (this.teacherDuties.get(b.name) || 0);
        });

        const cooldownAdjust = (teacherName) => {
            const cooldown = this.teacherCooldown.get(teacherName) || { half: 0, full: 0 };
            const isSubjectTeacher = this.teachers.find(t => t.name === teacherName && t.subjects.includes(exam.subject));
            if (isSubjectTeacher) {
                this.teacherCooldown.set(teacherName, { half: day + 2, full: day + 3 });
            } else {
                this.teacherCooldown.set(teacherName, { half: cooldown.half, full: cooldown.full });
            }
        };

        if (half === 'first' && !subjectTeacher) {
            const nonSubjectTeacher = candidates.find(t => t.subjects.includes(exam.subject));
            if (nonSubjectTeacher) {
                const lastSubjectDay = this.teacherSubjectDays.get(nonSubjectTeacher.name) || 0;
                const daysSinceSubject = day - lastSubjectDay;
                if (daysSinceSubject >= 3) {
                    this.teacherDuties.set(nonSubjectTeacher.name, (this.teacherDuties.get(nonSubjectTeacher.name) || 0) + 1);
                    cooldownAdjust(nonSubjectTeacher.name);
                    this.teacherAssignedHall.set(nonSubjectTeacher.name, exam.hall);
                    return nonSubjectTeacher.name;
                }
            }
        }

        if (half === 'second' && previousHalf !== "UNASSIGNED") {
            const lastSubjectDay = this.teacherSubjectDays.get(previousHalf) || 0;
            if (day - lastSubjectDay >= 3 && candidates.some(t => t.name === previousHalf)) {
                this.teacherDuties.set(previousHalf, (this.teacherDuties.get(previousHalf) || 0) + 1);
                return previousHalf;
            }
        }

        const leastBusy = candidates.find(t => 
            t.grade === exam.grade && 
            (half === 'second' ? t.name !== previousHalf : true) &&
            (this.teacherCooldown.get(t.name)?.half || 0) < day
        );

        if (leastBusy) {
            this.teacherDuties.set(leastBusy.name, (this.teacherDuties.get(leastBusy.name) || 0) + 1);
            cooldownAdjust(leastBusy.name);
            this.teacherAssignedHall.set(leastBusy.name, exam.hall);
            return leastBusy.name;
        }

        const fallback = candidates.sort((a, b) => {
            const aIsComputer = a.subjects.includes('Computer') && a.grade >= 4 && a.grade <= 8;
            const bIsComputer = b.subjects.includes('Computer') && b.grade >= 4 && b.grade <= 8;
            if (aIsComputer && !bIsComputer) return 1;
            if (!aIsComputer && bIsComputer) return -1;
            return (this.teacherDuties.get(a.name) || 0) - (this.teacherDuties.get(b.name) || 0);
        })[0];

        if (fallback) {
            const lastSubjectDay = this.teacherSubjectDays.get(fallback.name) || 0;
            const daysSinceSubject = day - lastSubjectDay;
            if (daysSinceSubject >= 3 || !fallback.subjects.includes(exam.subject)) {
                this.teacherDuties.set(fallback.name, (this.teacherDuties.get(fallback.name) || 0) + 1);
                cooldownAdjust(fallback.name);
                this.teacherAssignedHall.set(fallback.name, exam.hall);
                return fallback.name;
            }
        }

        return "UNASSIGNED";
    }

    isTeacherAssigned(teacherName, day, excludeHall) {
        const assignedHall = this.teacherAssignedHall.get(teacherName);
        return assignedHall && assignedHall !== excludeHall;
    }

    checkConflicts(firstHalf, secondHalf) {
        return firstHalf === secondHalf && firstHalf !== "UNASSIGNED";
    }

    ensureMinimumDuty(day, availableTeachers) {
        const assignedTeachers = new Set();
        this.schedule[day].forEach(slot => {
            assignedTeachers.add(slot.firstHalf);
            assignedTeachers.add(slot.secondHalf);
        });

        availableTeachers
            .filter(t => !assignedTeachers.has(t.name) && t.grade === parseInt(this.schedule[day][0]?.hall[0] || '0'))
            .sort((a, b) => {
                const aIsComputer = a.subjects.includes('Computer') && a.grade >= 4 && a.grade <= 8;
                const bIsComputer = b.subjects.includes('Computer') && b.grade >= 4 && b.grade <= 8;
                if (aIsComputer && !bIsComputer) return 1;
                if (!aIsComputer && bIsComputer) return -1;
                return (this.teacherDuties.get(a.name) || 0) - (this.teacherDuties.get(b.name) || 0);
            })
            .forEach(teacher => {
                const availableSlot = this.schedule[day].find(slot => 
                    slot.secondHalf === "UNASSIGNED" && 
                    !this.isTeacherAssigned(teacher.name, day, slot.hall)
                );
                if (availableSlot) {
                    const lastSubjectDay = this.teacherSubjectDays.get(teacher.name) || 0;
                    const daysSinceSubject = day - lastSubjectDay;
                    if (daysSinceSubject >= 3 || !teacher.subjects.includes(availableSlot.subject)) {
                        availableSlot.secondHalf = teacher.name;
                        this.teacherDuties.set(teacher.name, (this.teacherDuties.get(teacher.name) || 0) + 1);
                        this.teacherAssignedHall.set(teacher.name, availableSlot.hall);
                    }
                }
            });
    }

    displayDutyCharts() {
        const lowerGradesTeachers = this.teachers.filter(t => t.grade <= 6);
        const upperGradesTeachers = this.teachers.filter(t => t.grade >= 7);

        const lowerGradesData = lowerGradesTeachers.map(teacher => ({
            name: teacher.name,
            duties: this.teacherDuties.get(teacher.name) || 0
        }));

        const upperGradesData = upperGradesTeachers.map(teacher => ({
            name: teacher.name,
            duties: this.teacherDuties.get(teacher.name) || 0
        }));

        if (chartLowerGrades) chartLowerGrades.destroy();
        if (chartUpperGrades) chartUpperGrades.destroy();

        chartLowerGrades = new Chart(document.getElementById('chartLowerGrades'), {
            type: 'bar',
            data: {
                labels: lowerGradesData.map(t => t.name),
                datasets: [{
                    label: 'Number of Halves on Duty (Grades 4-6)',
                    data: lowerGradesData.map(t => t.duties),
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Number of Halves' } },
                    x: { title: { display: true, text: 'Teachers' } }
                }
            }
        });

        chartUpperGrades = new Chart(document.getElementById('chartUpperGrades'), {
            type: 'bar',
            data: {
                labels: upperGradesData.map(t => t.name),
                datasets: [{
                    label: 'Number of Halves on Duty (Grades 7-10)',
                    data: upperGradesData.map(t => t.duties),
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Number of Halves' } },
                    x: { title: { display: true, text: 'Teachers' } }
                }
            }
        });
    }
}

function generateSchedule() {
    if (!teacherData.length) {
        alert('Please submit teacher data first.');
        return;
    }
    if (!examRoutine.length) {
        alert('Please submit exam routine with at least one exam defined.');
        return;
    }

    const loading = document.getElementById('loading');
    loading.style.display = 'flex';

    setTimeout(() => {
        try {
            const scheduler = new Scheduler(examRoutine, teacherData);
            schedule = scheduler.generateSchedule();
            displaySchedule(schedule);
        } catch (error) {
            alert('Error generating schedule: ' + error.message);
        } finally {
            loading.style.display = 'none';
        }
    }, 1000);
}

function displaySchedule(scheduleData) {
    schedule = scheduleData;
    const days = Object.keys(schedule).map(Number).sort((a, b) => a - b);
    let html = '';

    days.forEach(day => {
        const daySlots = schedule[day];
        const lowerGradesSlots = daySlots.filter(slot => slot.grade <= 6);
        const upperGradesSlots = daySlots.filter(slot => slot.grade >= 7);

        if (lowerGradesSlots.length > 0 || upperGradesSlots.length > 0) {
            html += `<h3>Day ${day}</h3>`;

            if (lowerGradesSlots.length > 0) {
                html += '<h4>Grades 4-6</h4><table>';
                html += '<tr><th>S.N</th><th>Exam Hall</th><th>1st Half</th><th>2nd Half</th></tr>';
                lowerGradesSlots.forEach((slot, index) => {
                    const conflictClass = slot.conflicts ? 'conflict' : '';
                    const dayClass = `day-${day}`;
                    html += `
                        <tr class="${conflictClass} ${dayClass}">
                            <td>${index + 1}</td>
                            <td>${slot.subject} (${slot.hall})</td>
                            <td>${slot.firstHalf}</td>
                            <td>${slot.secondHalf}</td>
                        </tr>`;
                });
                html += '</table>';
            }

            if (upperGradesSlots.length > 0) {
                html += '<h4>Grades 7-10</h4><table>';
                html += '<tr><th>S.N</th><th>Exam Hall</th><th>1st Half</th><th>2nd Half</th></tr>';
                upperGradesSlots.forEach((slot, index) => {
                    const conflictClass = slot.conflicts ? 'conflict' : '';
                    const dayClass = `day-${day}`;
                    html += `
                        <tr class="${conflictClass} ${dayClass}">
                            <td>${index + 1}</td>
                            <td>${slot.subject} (${slot.hall})</td>
                            <td>${slot.firstHalf}</td>
                            <td>${slot.secondHalf}</td>
                        </tr>`;
                });
                html += '</table>';
            }
        }
    });

    html += '<button onclick="exportToPDF()" class="export-btn">Export to PDF</button>';
    document.getElementById('scheduleOutput').innerHTML = html;
}

async function exportToPDF() {
    if (!schedule) {
        alert('No schedule available to export. Please generate a schedule first.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Header on First Page
    doc.setFontSize(16);
    doc.text("Watchtower for Exams - Schedule", 10, 10);
    doc.setFontSize(12);
    doc.text("Invigilation Duties", 10, 20);

    // Schedule Tables
    let yOffset = 30;
    const days = Object.keys(schedule).map(Number).sort((a, b) => a - b);

    days.forEach(day => {
        const daySlots = schedule[day];
        const lowerGradesSlots = daySlots.filter(slot => slot.grade <= 6);
        const upperGradesSlots = daySlots.filter(slot => slot.grade >= 7);

        if (lowerGradesSlots.length > 0 || upperGradesSlots.length > 0) {
            doc.setFontSize(14);
            doc.text(`Day ${day}`, 10, yOffset);
            yOffset += 10;

            if (lowerGradesSlots.length > 0) {
                doc.setFontSize(12);
                doc.text("Grades 4-6", 10, yOffset);
                yOffset += 10;
                const lowerTableData = lowerGradesSlots.map((slot, index) => [
                    index + 1,
                    `${slot.subject} (${slot.hall})`,
                    slot.firstHalf,
                    slot.secondHalf
                ]);
                doc.autoTable({
                    startY: yOffset,
                    head: [['S.N', 'Exam Hall', '1st Half', '2nd Half']],
                    body: lowerTableData,
                    styles: { fontSize: 8, cellPadding: 2 },
                    headStyles: { fillColor: [242, 242, 242], textColor: [51, 51, 51] },
                    bodyStyles: { fillColor: [255, 255, 255] },
                    alternateRowStyles: { fillColor: [245, 245, 245] }
                });
                yOffset = doc.lastAutoTable.finalY + 10;
            }

            if (upperGradesSlots.length > 0) {
                doc.setFontSize(12);
                doc.text("Grades 7-10", 10, yOffset);
                yOffset += 10;
                const upperTableData = upperGradesSlots.map((slot, index) => [
                    index + 1,
                    `${slot.subject} (${slot.hall})`,
                    slot.firstHalf,
                    slot.secondHalf
                ]);
                doc.autoTable({
                    startY: yOffset,
                    head: [['S.N', 'Exam Hall', '1st Half', '2nd Half']],
                    body: upperTableData,
                    styles: { fontSize: 8, cellPadding: 2 },
                    headStyles: { fillColor: [242, 242, 242], textColor: [51, 51, 51] },
                    bodyStyles: { fillColor: [255, 255, 255] },
                    alternateRowStyles: { fillColor: [245, 245, 245] }
                });
                yOffset = doc.lastAutoTable.finalY + 10;
            }

            if (yOffset > 250) {
                doc.addPage();
                yOffset = 20;
            }
        }
    });

    // Add Duty Distribution Section (New Page)
    doc.addPage();
    yOffset = 20;
    doc.setFontSize(16);
    doc.text("Duty Distribution", 10, yOffset);
    yOffset += 10;

    // Lower Grades Chart (Full Page)
    const lowerChartCanvas = document.getElementById('chartLowerGrades');
    if (lowerChartCanvas && chartLowerGrades) {
        const lowerChartImage = await html2canvas(lowerChartCanvas, { scale: 2 }).then(canvas => canvas.toDataURL('image/png'));
        doc.setFontSize(14);
        doc.text("Grades 4-6 Duty Distribution", 10, yOffset);
        yOffset += 10;
        doc.addImage(lowerChartImage, 'PNG', 10, yOffset, 190, 247); // Full A4 width (210mm - 20mm margins), height to fit page
        doc.addPage(); // New page for next chart
        yOffset = 20;
    }

    // Upper Grades Chart (Full Page)
    const upperChartCanvas = document.getElementById('chartUpperGrades');
    if (upperChartCanvas && chartUpperGrades) {
        const upperChartImage = await html2canvas(upperChartCanvas, { scale: 2 }).then(canvas => canvas.toDataURL('image/png'));
        doc.setFontSize(14);
        doc.text("Grades 7-10 Duty Distribution", 10, yOffset);
        yOffset += 10;
        doc.addImage(upperChartImage, 'PNG', 10, yOffset, 190, 247); // Full A4 width, height to fit page
    }

    // Footer on Last Page
    doc.setFontSize(10);
    doc.text("Created by Rajat", doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10);

    doc.save("watchtower_exam_schedule.pdf");
}