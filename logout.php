<?php
session_name('mini_harita_session');
session_start();
session_unset();
session_destroy();
header("Location: index.php");
exit();
?>
