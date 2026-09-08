const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// เปิดให้บริการไฟล์ในโฟลเดอร์ public
app.use(express.static(path.join(__dirname, 'public')));

// ข้อมูลห้องพักเล่นแบบ In-Memory
const rooms = {};

// ข้อมูล 22 ตำแหน่งงาน
const rolesData = [
    { name: "ประธานบริษัท (CEO)", salary: 120000, debt: 70000, mental: 50, icon: "ceo.png" },
    { name: "รองประธาน (VP)", salary: 90000, debt: 50000, mental: 55, icon: "vp.png" },
    { name: "ผจก.โรงงาน", salary: 70000, debt: 40000, mental: 60, icon: "factory_mgr.png" },
    { name: "วิศวกรประเมินราคา", salary: 40000, debt: 22000, mental: 70, icon: "estimator.png" },
    { name: "พนักงานฝ่ายขาย", salary: 45000, debt: 25000, mental: 70, icon: "sales.png" },
    { name: "จัดซื้อ", salary: 32000, debt: 16000, mental: 80, icon: "procurement.png" },
    { name: "จัดหา", salary: 32000, debt: 16000, mental: 80, icon: "sourcing.png" },
    { name: "โลจิสติกส์", salary: 30000, debt: 15000, mental: 80, icon: "logistics.png" },
    { name: "พนักงานบัญชี", salary: 35000, debt: 18000, mental: 80, icon: "accountant.png" },
    { name: "พนักงานฝ่ายบุคคล (HR)", salary: 35000, debt: 18000, mental: 85, icon: "hr.png" },
    { name: "Draftsman", salary: 28000, debt: 14000, mental: 75, icon: "draftsman.png" },
    { name: "วิศวกร", salary: 38000, debt: 20000, mental: 75, icon: "engineer.png" },
    { name: "Project Engineer", salary: 42000, debt: 23000, mental: 70, icon: "project_eng.png" },
    { name: "QC Engineer", salary: 38000, debt: 20000, mental: 75, icon: "qc.png" },
    { name: "วิศวกรการจัดการบริการ", salary: 38000, debt: 20000, mental: 75, icon: "service_eng.png" },
    { name: "แม่บ้าน", salary: 15000, debt: 5000, mental: 100, icon: "maid.png" },
    { name: "โฟแมน", salary: 26000, debt: 12000, mental: 85, icon: "foreman.png" },
    { name: "พนักงานเชื่อม", salary: 24000, debt: 10000, mental: 85, icon: "welder.png" },
    { name: "Helper", salary: 18000, debt: 6000, mental: 95, icon: "helper.png" },
    { name: "Safety", salary: 32000, debt: 15000, mental: 85, icon: "safety.png" },
    { name: "คนสวน", salary: 15000, debt: 5000, mental: 100, icon: "gardener.png" },
    { name: "คนขับรถ", salary: 18000, debt: 6000, mental: 95, icon: "driver.png" }
];

io.on('connection', (socket) => {
    // 1. สร้างห้องใหม่
    socket.on('createRoom', (playerName) => {
        const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        const randomRole = rolesData[Math.floor(Math.random() * rolesData.length)];
        
        rooms[roomId] = {
            id: roomId,
            players: [{
                id: socket.id,
                name: playerName || "ผู้เล่น 1",
                role: randomRole,
                isBot: false,
                money: randomRole.salary,
                passive: 0,
                kpiGoal: randomRole.salary * 0.8,
                mental: randomRole.mental,
                pos: 0,
                isInnerLoop: false
            }],
            turnIndex: 0
        };
        
        socket.join(roomId);
        socket.emit('roomCreated', { roomId, player: rooms[roomId].players[0] });
        io.to(roomId).emit('updateRoom', rooms[roomId]);
    });

    // 2. เข้าร่วมห้อง
    socket.on('joinRoom', ({ roomId, playerName }) => {
        const room = rooms[roomId];
        if (room && room.players.length < 6) {
            const randomRole = rolesData[Math.floor(Math.random() * rolesData.length)];
            const newPlayer = {
                id: socket.id,
                name: playerName || `ผู้เล่น ${room.players.length + 1}`,
                role: randomRole,
                isBot: false,
                money: randomRole.salary,
                passive: 0,
                kpiGoal: randomRole.salary * 0.8,
                mental: randomRole.mental,
                pos: 0,
                isInnerLoop: false
            };
            room.players.push(newPlayer);
            socket.join(roomId);
            io.to(roomId).emit('updateRoom', room);
        } else {
            socket.emit('errorMsg', 'หาห้องไม่พบ หรือห้องเต็มแล้ว (สูงสุด 6 คน)');
        }
    });

    // 3. เพิ่มบอท AI
    socket.on('addBot', (roomId) => {
        const room = rooms[roomId];
        if (room && room.players.length < 6) {
            const botNum = room.players.length + 1;
            const randomRole = rolesData[Math.floor(Math.random() * rolesData.length)];
            const botPlayer = {
                id: `bot_${Date.now()}_${botNum}`,
                name: `บอท AI ${botNum}`,
                role: randomRole,
                isBot: true,
                money: randomRole.salary,
                passive: 0,
                kpiGoal: randomRole.salary * 0.8,
                mental: randomRole.mental,
                pos: 0,
                isInnerLoop: false
            };
            room.players.push(botPlayer);
            io.to(roomId).emit('updateRoom', room);
        }
    });

    // 4. ทอยลูกเต๋า
    socket.on('rollDice', (roomId) => {
        const room = rooms[roomId];
        if (!room) return;

        const currentPlayer = room.players[room.turnIndex];
        const diceValue = Math.floor(Math.random() * 6) + 1;
        
        // อัปเดตตำแหน่ง
        const maxPos = currentPlayer.isInnerLoop ? 14 : 24;
        currentPlayer.pos = (currentPlayer.pos + diceValue) % maxPos;

        io.to(roomId).emit('diceRolled', {
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            diceValue,
            newPos: currentPlayer.pos
        });

        // สลับตาผู้เล่นถัดไป
        room.turnIndex = (room.turnIndex + 1) % room.players.length;
        io.to(roomId).emit('updateRoom', room);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});