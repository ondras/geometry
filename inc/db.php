<?php
	include("config.php");

	class GeometryDB extends DB {
		const GAME		= "game";
		const PLAYER	= "player";
		const ROUND		= "gameround";

		public function __construct() {
			global $user, $pass, $db;
			parent::__construct("mysql:host=localhost;dbname=".$db, $user, $pass, array(PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8"));
		}
		
		public function removePlayer($id) {
			$this->delete(self::PLAYER, $id);
			$this->delete(self::ROUND, array("id_player"=>$id));
		}
		
		public function addPlayerToGame($id, $nick, $color, $length, $name) {
			$this->removePlayer($id);

			$game = $this->query("SELECT id FROM ".self::GAME." WHERE name = ?", $name);
			$id_game = 0;
			
			if (count($game)) { /* there is a game; is it old? */
				$id_game = $game[0]["id"];
				if ($this->purgeOldGame($id_game)) { $id_game = 0; }
			}

			if (!$id_game) { /* no game, create one */
				$ts = time() + $length;
				$id_game = $this->insert(self::GAME, array("length"=>$length, "ts"=>$ts, "name"=>$name));
			}
			
			$test = $this->query("SELECT id FROM ".self::PLAYER." WHERE id_game = ? AND nick = ?", $id_game, $nick);
			if (count($test)) { return null; } /* someone with this nick already present! */
			
			$this->insert(self::PLAYER, array("id"=>$id, "id_game"=>$id_game, "color"=>$color, "nick"=>$nick));
			return $id_game;
		}
		
		public function getGameForPlayer($id) {
			$data = $this->query("SELECT id_game FROM ".self::PLAYER." WHERE id = ?", $id);
			$id_game = null;
			
			if (count($data)) {
				$id_game = $data[0]["id_game"];
				if ($this->purgeOldGame($id_game)) { $id_game = null; }
			}
			
			return $id_game;
		}
		
		public function insertGameData($id, $data) {
			$id_game = $this->getGameForPlayer($id);
			if (!$id_game) { return null; }
			$this->insert(self::ROUND, array("id_player"=>$id, "id_game"=>$id_game, "data"=>$data, "done"=>0));
			return $id_game;
		}
		
		public function getGameResults($id_game) {
			$this->query("SELECT GET_LOCK('geometry', 5)");

			$data = $this->getGameData($id_game);
			$diff = time() - $data["ts"]; /* difference from round end */
			
			if ($diff >= 0) { /* just finished */
				$this->query("DELETE FROM ".self::ROUND." WHERE id_game = ? AND done = 1", $id_game); /* delete obsolete results */
				$this->update(self::ROUND, array("id_game"=>$id_game), array("done"=>1)); /* mark all rounds as finished */
				$ts = time() + $data["length"];
				$this->update(self::GAME, $id_game, array("ts"=>$ts)); /* schedule new time */
			} 
			
			$this->query("DO RELEASE_LOCK('geometry')");

			return $this->query("SELECT * FROM ".self::ROUND." WHERE id_game = ? AND done = 1", $id_game);
		}
		
		public function getGameData($id_game) {
			$data = $this->query("SELECT * FROM ".self::GAME." WHERE id = ?", $id_game);
			return $data[0];
		}
		
		public function getGamePlayers($id_game) {
			return $this->query("SELECT * FROM ".self::PLAYER." WHERE id_game = ?", $id_game);
		}
		
		/**
		 * Is this game too old and obsolete?
		 */
		private function purgeOldGame($id_game) {
			$data = $this->getGameData($id_game);
			$diff = time() - $data["ts"];
			if ($diff > $data["length"]) { /* too old, remove */
				$this->delete(self::ROUND, array("id_game"=>$id_game)); /* delete rounds  */
				$this->delete(self::PLAYER, array("id_game"=>$id_game)); /* delete players  */
				$this->delete(self::GAME, $id_game); /* delete game */
				return true;
			} else { /* game is okay */
				return false;
			}
		}
	}
?>
