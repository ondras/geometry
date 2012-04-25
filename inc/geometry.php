<?php
	session_start();
	include("oz.php");
	include("db.php");

	class Geometry extends APP {
		private $db = null;
		private $debug = true;

		protected $dispatch_table = array(
			'POST	^/join$		join',
			'POST	^/play$		play',
			'POST	^/results$	results',
			'POST	^/leave$	leave'
		);
		
		public function __construct() {
			$this->db = new GeometryDB();
			$this->view = new XML();

			try {
				header("Content-type: text/xml");
				$this->dispatch();
			} catch (Exception $e) {
				$this->error500();
				if ($this->debug) {
					echo "<pre>" . print_r($e, true) . "</pre>";
				} else {
					error_log(print_r($e, true));
				}
			}
		}
		
		public function join() {
			$id = HTTP::value("id", "post", null);
			$nick = HTTP::value("nick", "post", null);
			$color = HTTP::value("color", "post", "red");
			$length = HTTP::value("length", "post", 30);
			$game = HTTP::value("game", "post", null);
			/* FIXME zvalidovat */
			
			$id_game = $this->db->addPlayerToGame($id, $nick, $color, $length, $game);
			if (!$id_game) { $this->error("duplicate nick FIXME"); }
			
			$this->gameInfo($id_game);
		}
		
		public function play() {
			$id = HTTP::value("id", "post", null);
			$data = HTTP::value("data", "post", null);
			/* FIXME zvalidovat */
			
			$id_game = $this->db->insertGameData($id, $data);
			if (!$id_game) { return $this->error("not joined FIXME"); }
			
			$this->gameInfo($id_game);
		}
		
		public function results() {
			$id = HTTP::value("id", "post", null);
			/* FIXME zvalidovat */

			$id_game = $this->db->getGameForPlayer($id);
			if (!$id_game) { return $this->error("not joined FIXME"); }
			
			$data = $this->db->getGameResults($id_game);
			if (count($data)) { $this->view->addData("gameresults", array("move"=>$data)); }
			$this->gameInfo($id_game);
		}
		
		public function leave() {
			$id = HTTP::value("id", "post", null);
			/* FIXME zvalidovat */
			
			$this->db->removePlayer($id);
			echo $this->view->toString();
		}

		private function gameInfo($id_game) {
			$data = $this->db->getGameData($id_game);
			$players = $this->db->getGamePlayers($id_game);
			$data["players"] = array("player"=>$players);
			$data["now"] = time();

			$this->view->addData("gameinfo", $data);
			echo $this->view->toString();
		}
		
		private function error($reason) {
			$this->view->addData("error", array(""=>$reason));
			echo $this->view->toString();
		}
	}
?>
