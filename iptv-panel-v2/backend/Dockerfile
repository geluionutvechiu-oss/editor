FROM php:8.3-fpm-alpine

ADD https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions /usr/local/bin/
RUN chmod +x /usr/local/bin/install-php-extensions \
    && install-php-extensions pdo_pgsql mbstring exif pcntl bcmath gd redis \
    && apk add --no-cache git curl zip unzip \
    && curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

WORKDIR /var/www/html

COPY composer.json composer.lock* ./
RUN composer install --no-interaction --prefer-dist --no-scripts

COPY . .

# Create .env from environment (Laravel requires the file to exist)
RUN echo "APP_NAME=IPTVPanel" > .env \
    && composer dump-autoload --optimize \
    && chmod -R 775 storage bootstrap/cache

EXPOSE 8000

CMD printf "APP_NAME=IPTVPanel\nAPP_ENV=${APP_ENV:-production}\nAPP_KEY=${APP_KEY}\nAPP_DEBUG=${APP_DEBUG:-false}\nDB_CONNECTION=${DB_CONNECTION:-pgsql}\nDB_HOST=${DB_HOST:-postgres}\nDB_PORT=${DB_PORT:-5432}\nDB_DATABASE=${DB_DATABASE:-iptv_panel}\nDB_USERNAME=${DB_USERNAME:-iptv_user}\nDB_PASSWORD=${DB_PASSWORD}\nREDIS_HOST=${REDIS_HOST:-redis}\nREDIS_PORT=${REDIS_PORT:-6379}\nCACHE_STORE=${CACHE_STORE:-redis}\nQUEUE_CONNECTION=${QUEUE_CONNECTION:-redis}\nSESSION_DRIVER=${SESSION_DRIVER:-redis}\nJWT_SECRET=${JWT_SECRET}\nLOG_CHANNEL=${LOG_CHANNEL:-stack}\nLOG_LEVEL=${LOG_LEVEL:-debug}\n" > .env \
    && php artisan config:clear \
    && php artisan migrate --force \
    && php artisan db:seed --force --class=DatabaseSeeder \
    && php artisan serve --host=0.0.0.0 --port=8000
