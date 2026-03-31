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

CMD php artisan config:clear; \
    php artisan migrate --force; \
    php artisan db:seed --force --class=DatabaseSeeder; \
    php artisan serve --host=0.0.0.0 --port=8000
