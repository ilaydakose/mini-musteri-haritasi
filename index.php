<?php
session_name('mini_harita_session');
session_start();

$loggedIn    = isset($_SESSION['loggedin']) && $_SESSION['loggedin'] === true;
$sessionRole = $_SESSION['user_role'] ?? null;
$sessionName = $_SESSION['username'] ?? '';

?>
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mini Harita</title>
    <link rel="icon" href="/prolegal-svg.png" type="image/png">
    <link rel="stylesheet" href="styles.css">
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
</head>
<body>
    <!-- Video Arka Plan -->
    <video class="video-background" autoplay muted loop playsinline>
        <source src="video.mp4" type="video/mp4">
        Tarayıcınız video etiketini desteklemiyor.
    </video>

    <div class="login-container">
        <div class="login-box">
            <h2 style="font-size: 22px; font-weight: 600;">Giriş</h2>

            <form id="loginForm" style="<?php echo $loggedIn ? 'display:none;' : 'display:block;'; ?>">
                <div class="input-group">
                    <label for="username">Kullanıcı Adı</label>
                    <input type="text" id="username" name="username" required>
                </div>
                <div class="input-group">
                    <label for="password">Şifre</label>
                    <input type="password" id="password" name="password" required>
                </div>
                <button type="submit" class="btn">Giriş Yap</button>
            </form>
            <div id="postLoginOptions" style="<?php echo $loggedIn ? 'display:block;' : 'display:none;'; ?> margin-top:16px;" data-username="<?php echo htmlspecialchars($sessionName, ENT_QUOTES, 'UTF-8'); ?>">
                <p style="margin-bottom:12px; font-weight:600;">Merhaba <?php echo htmlspecialchars($sessionName, ENT_QUOTES, 'UTF-8'); ?></p>
                <button type="button" class="btn" style="width:100%; margin-bottom:10px;" onclick="window.location.href='dashboard.php'">Harita Sistemi</button>
            </div>
            <p id="responseMessage" style="color:red; display:none;"></p>
        </div>
    </div>

    <script>
        $(document).ready(function() {
            $('#loginForm').submit(function(e) {
                e.preventDefault(); // Formun normal gönderimini engeller

                $.ajax({
                    type: 'POST',
                    url: 'login.php',
                    data: $(this).serialize(), // Form verilerini gönderiyoruz
                    success: function(response) {
                        const result = JSON.parse(response); // JSON yanıtı alıyoruz
                        if (result.success) {
                            $('#responseMessage').css('color', 'green').text('Giriş başarılı...').show();
                                $('#loginForm').hide();
                                window.loggedUsername = result.username || '';
                                $('#postLoginOptions').data('username', window.loggedUsername);
                                $('#postLoginOptions').show();
                        } else {
                            $('#responseMessage').css('color', 'red').text(result.message).show();
                        }
                    }
                });
            });
        });
    </script>


</body>
</html>
