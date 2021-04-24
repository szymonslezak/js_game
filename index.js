var http = require('http');
var fs = require('fs');
var socket = require('socket.io');
const { getUnpackedSettings } = require('http2');
var html = fs.readFileSync("index.html");

var i = 1;
var rozmowa = [];
var moves = [];
var players = [];
var winner = [false, false];
var ready = [false, false];
var player1 = { money: 3, exp: 0, foot_lvl: 1, arch_lvl: 1 }
var player2 = { money: 3, exp: 0, foot_lvl: 1, arch_lvl: 1 }
var units = {};
var unit_count = 0;
let player1_socket;
let player2_socket;

//create a server object
var server = http.createServer(function (req, res) { // function to handle request
	res.write(html)
	res.end(); //end the response
})

var io = socket(server);

io.on('connection', function (socket) {
	// powstaje nowy socket przez który będziemy gadać z kolejnym klientem
	socket.id = i++;

	// wysyłamy wartość nadanego id
	socket.emit("id", socket.id)

	// wysyłamy dotychczasowy przebieg rozmowy
	for (let msg of rozmowa)
		socket.emit('chat message', msg);


	for (let x of moves)
		socket.emit('move', x);

	// ustawiamy sposób reakcji na otrzymywane wiadomości
	socket.on('chat message', function (msg) {
		rozmowa.push(msg)             // zapamiętaj  
		io.emit('chat message', msg); // i wyślij do wszystkich
	})

	socket.on('nick', function (nick) {
		socket.nick = nick;
		socket.emit('chat message', "Witaj " + nick + "!"); // i wyślij do wszystkich
	})
	socket.on('add_unit', function (unit) {
		unit = JSON.parse(unit);
		console.log(unit);
		console.log(typeof (unit));
		let player;
		if (players.includes(socket)) {
			if (players[0] == socket) {
				player = player1;
				if (ready[0])
					return;
			}
			else {
				unit.pole = 101 - unit.pole; //to ogarnij
				player = player2;
				if (ready[1])
					return;
			}
			if (player.money > 0) {
				console.log("chacking pole")
				console.log(unit.pole);
				if (unit.pole <= 10 || unit.pole >= 90) {
					console.log("checking def")
					let find_el = find_element(unit.pole);
					if (find_el == undefined) {
						let hp = 0;
						let attack = 0;
						let range = 0;
						if (unit.type == 1) {
							hp = player.foot_lvl * 4;
							attack = player.foot_lvl * 2;
						}
						else {
							hp = player.arch_lvl * 1;
							attack = player.arch_lvl * 1;
							range = player.arch_lvl * 2;
						}
						console.log("adding_unit")
						console.log(unit.pole)
						units[++unit_count] = { player: socket.id, pole: unit.pole, type: unit.type, hp: hp, attack: attack, range: range, alive: true, target: unit.pole };
						player.money--;
						socket.emit("player_info", player);
						socket.emit("unit_info", units[unit_count]);
					}
				}
			}
		}
	})
	socket.on('upgrade_unit', function (type) {
		let player;
		if (players.includes(socket)) {
			if (players[0] == socket) {
				player = player1;
				sck = player1_socket;
				if (ready[0])
					return;
			}
			else {
				player = player2;
				sck = player2_socket;
				if (ready[1])
					return;
			}
			if (type == 1) {
				if (player.exp >= player.foot_lvl * 2) {
					player.exp -= player.foot_lvl * 2;
					player.foot_lvl++;
					socket.emit("player_info", player);
				}
			}
			else {
				if (player.exp >= player.arch_lvl * 2) {
					player.exp -= player.arch_lvl * 2;
					player.arch_lvl++;
					socket.emit("player_info", player);
				}
			}

		}
	});
	socket.on('remove_unit', function (index) {

		if (players.includes(socket)) {
			if (players[0] == socket) {
			}
			else {
				index = 101 - index; //to ogarnij
			}
			if (index < 10 || index > 90) {
				let unit_id = 0;
				let found = false;
				for (let unit in units) {
					unit_id = unit;
					unit = units[unit];
					if (unit.pole == index) {
						index = unit_id;
						found = true;
					}
				}
				if (found && units[index].player == socket.id) {
					delete units[index];
				}
			}
		}
	})

	// ustawiamy sposób reakcji na ruchy
	socket.on('join', function () {
		if (!players.includes(socket))
			if (players[0] == undefined) {
				console.log("player1");
				socket.emit('assign_player', 0);
				players[0] = socket;
				player1_socket = socket;
			}
			else if (players[1] == undefined) {
				console.log("player2");
				socket.emit('assign_player', 1);
				players[1] = socket;
				player2_socket = socket;
			}
			else
				socket.emit('chat message', "Niestety " + info(socket) + ". W tę grę grają " + info(players[0]) + " oraz " + info(players[1]) + ". Zaczekaj aż skończą.")

	});
	socket.on('end_turn', function () {

		//let x=JSON.parse(msg)
		//console.log("end_called");
		if (players.includes(socket) && !winner[0] && !winner[0]) {
			if (players[0] == socket) {
				ready[0] = true;
				io.emit('ready',0);
			}
			else if (players[1] == socket) {
				ready[1] = true;
				io.emit('ready',1);
			}

			if (ready[0] && ready[1]) {
				//console.log("next_turn");
				calc_turn();
				//console.log(units);
				io.emit('move', units);
				if (winner[0] && winner[1]) {
					let msg = "PADŁ REMIS";
					io.emit('chat message', msg);

				}
				else if (winner[0]) {
					let msg = info(players[1]) + " wygrywa!";
					io.emit('chat message', msg);
				}
				else if (winner[1]) {
					let msg = info(players[0]) + " wygrywa!";
					io.emit('chat message', msg);
				}
				player1.money = 3;
				player2.money = 3;
				ready[0] = false;
				ready[1] = false;
				io.emit('reset_ready');
				player1_socket.emit('player_info', player1);
				player2_socket.emit('player_info', player2);
			}

		}

		

	})

	socket.on('reset', function (msg) {
		rozmowa = [];
		moves = [];
		td = [];
		last = 0;
		players = [];
		winner = [false, false];
		ready = [false, false];
		player1 = { money: 3, exp: 0, foot_lvl: 1, arch_lvl: 1 }
		player2 = { money: 3, exp: 0, foot_lvl: 1, arch_lvl: 1 }
		units = {};
		unit_count = 0;
		player1_socket;
		player2_socket;
		io.emit('reset', msg); // do wszystkich
	})

	socket.on("disconnect", function (msg) {
		if (players.includes(socket)) {
			let [a, b] = players;
			winner = socket == a ? b : a;
			let msg = info(socket) + " się rozłączył. Gra przerwana. " + info(winner) + " wygrywa!";
			io.emit('chat message', msg);
			rozmowa.push(msg);
		}
	});
});

function calc_turn() {
	let player = 1;
	//console.log(units);
	for (let unit in units) {
		/*	console.log("calc")
			console.log(unit)*/
		unit = units[unit];
		player = 1;
		if (unit.player == players[0].id)
			player = -1;
		let target = 0;
		if (unit.range == 0) {
			target = unit.pole + player * 10;
			target_unit = find_element(target);
			if (target_unit != undefined && target_unit.player != unit.player) {
				target_unit.hp -= unit.attack;
				if (target_unit.hp > 0)
					target = target;
				else {
					target_unit.alive = false;
				}
			}
		}
		else {
			for (let i = 1; i <= unit.range; i++) {
				target = unit.pole + i * player * 10;
				target_unit = find_element(target);

				if (target_unit != undefined && target_unit.player != unit.player) {
					console.log("attacking", target_unit)
					target_unit.hp -= unit.attack;
				}
				target = unit.pole;
			}
		}
		unit.target = target;
	}
	for (let unit in units) {
		//unit = units[unit];
		if (units[unit].hp < 1) {
			if (units[unit].player == players[0].id) {
				player2.exp += 1;
			}
			else {
				player1.exp += 1;
			}
			delete units[unit];
		}
	}
	for (let unit in units) {
		unit = units[unit];
		player = 0;
		if (unit.player == players[0].id)
			player = 1;
		let target = unit.target;
		//console.log("search unit",unit);
		let target_unit = find_element(target);
		if(target_unit&& target_unit.type == 1)
		console.log("find unit",target_unit)
		if (unit.pole != target && (target_unit == undefined /*|| target_unit.player == unit.player)*/)) {
			unit.pole = target;
			if (player == 0) {
				if (unit.pole >= 91) {
					winner[player] = true;
					console.log("WINNER1");
				}
			}
			else {
				if (unit.pole <= 10) {
					winner[player] = true;
					console.log("WINNER2");
				}
			}
		}
		else {
			console.log("unit",unit);
			//target = unit.pole;
		}
	}
}

function find_element(pole) {
	let el = undefined;
	for (let un in units) {
		un = units[un]
		if (un.pole == pole) {
			//console.log(pole);
			//console.log("found");
			return un;
		}
	}
	return el;
}

server.listen(8080);

function info(player) {
	console.log(player.nick);
	return player.nick + " (" + player.id + ")";
}