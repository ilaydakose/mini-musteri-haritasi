<?php
session_start();

$loggedIn    = isset($_SESSION['loggedin']) && $_SESSION['loggedin'] === true;
$sessionRole = $_SESSION['user_role'] ?? null;
$sessionName = $_SESSION['username'] ?? '';

// Partner kullanıcılar sadece Talep ekranına yönlendirilir
if ($loggedIn && $sessionRole === 'partner') {
    header("Location: talep/index.php");
    exit();
}
?>
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prolegal Bilgi Portalı</title>
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
            <div class="logo-container">
                <img src="prolegal-logo.svg" alt="Prolegal Logo" class="logo">
            </div>
            <h2 style="font-size: 22px; font-weight: 600;">Prolegal Bilgi Portalı</h2>

            <form id="loginForm" style="<?php echo ($loggedIn && $sessionRole !== 'partner') ? 'display:none;' : 'display:block;'; ?>">
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
            <div id="postLoginOptions" style="<?php echo ($loggedIn && $sessionRole !== 'partner') ? 'display:block;' : 'display:none;'; ?> margin-top:16px;" data-username="<?php echo htmlspecialchars($sessionName, ENT_QUOTES, 'UTF-8'); ?>">
                <p style="margin-bottom:12px; font-weight:600;">Merhaba <?php echo htmlspecialchars($sessionName, ENT_QUOTES, 'UTF-8'); ?></p>
                <button type="button" class="btn" style="width:100%; margin-bottom:10px;" onclick="window.location.href='dashboard.php'">Harita Sistemi</button>
                <button type="button" class="btn" style="width:100%; margin-bottom:10px;" onclick="window.location.href='talep/index.php'">Talep Formu</button>

                     <div onclick="window.location.href='https://tesvik.prolegal.com.tr/login'" style="cursor:pointer; width:100%; background-color:#11abbb; color:white; border-radius:10px; padding:15px 5px; text-align:center; margin-bottom:10px;">
                        <div style="font-weight:bold; font-size:16px; margin-bottom:5px;">Teşvik Asistanı</div>
                        <div style="font-size: 11px; opacity:0.9;">
                            <strong>Kullanıcı:</strong> prolegal mail adresiniz | <strong>Şifre:</strong> Prolegal-123
                        </div>
                    </div>

                    <div onclick="window.location.href='https://portal.prolegal.com.tr'" style="cursor:pointer; width:100%; background-color:#11abbb; color:white; border-radius:10px; padding:15px 5px; text-align:center; margin-bottom:10px;">
                        <div style="font-weight:bold; font-size:16px; margin-bottom:5px;">Müşteri Portalı(Demo)</div>
                        <div style="font-size: 11px; opacity:0.9;">
                            <strong>Üye Kullanıcı:</strong> customer-free@test.com | <strong>Şifre:</strong> Test123!<br>
                            <strong>Sözleşmeli müşteri:</strong> customer-premium@test.com | <strong>Şifre:</strong> Test123!
                        </div>
                    </div>

                    <div onclick="window.location.href='https://admin.prolegal.com.tr/src/pages/auth/login.html'" style="cursor:pointer; width:100%; background-color:#11abbb; color:white; border-radius:10px; padding:15px 5px; text-align:center; margin-bottom:10px;">
                        <div style="font-weight:bold; font-size:16px; margin-bottom:5px;">Admin Portalı(Demo)</div>
                        <div style="font-size: 11px; opacity:0.9;">
                            <strong>Kullanıcı:</strong> admin@test.com | <strong>Şifre:</strong> Test123!
                        </div>
                    </div>

                    <div onclick="window.location.href='https://sales.prolegal.com.tr/src/pages/auth/login.html'" style="cursor:pointer; width:100%; background-color:#11abbb; color:white; border-radius:10px; padding:15px 5px; text-align:center; margin-bottom:10px;">
                        <div style="font-weight:bold; font-size:16px; margin-bottom:5px;">Satış ve Pazarlama Portalı(Demo)</div>
                        <div style="font-size: 11px; opacity:0.9;">
                            <strong>Kullanıcı:</strong> sales@test.com | <strong>Şifre:</strong> Test123!
                        </div>
                    </div>
            </div>
            <br>Developed for Prolegal by Profintech<br>
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
                            if (result.role === 'partner') {
                                window.location.href = 'talep/index.php';
                            } else {
                                $('#loginForm').hide();
                                window.loggedUsername = result.username || '';
                                $('#postLoginOptions').data('username', window.loggedUsername);
                                $('#postLoginOptions').show();
                            }
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
