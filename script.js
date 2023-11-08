'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputTemp = document.querySelector('.form__input--temp');
const inputClimb = document.querySelector('.form__input--climb');
const rmWorkouts = document.querySelector('.remove__allworkouts');

//класс Workout который общий для двух видов тренировки
class Workout {
  date = new Date();
  id = String(Date.now()).slice(-10);
  constructor(coords, distance, duration) {
    this.coords = coords;
    this.distance = distance; //km
    this.duration = duration; //min
  }

  _setDescription() {
    this.type === 'running'
      ? (this.desciption = `Пробежка ${new Intl.DateTimeFormat(
          navigator.language
        ).format(this.date)}`)
      : (this.desciption = `Велотренировка ${new Intl.DateTimeFormat(
          navigator.language
        ).format(this.date)}`);
  }
}

//класс Бег
class Running extends Workout {
  type = 'running';
  //temp - темп (сколько шагов в минуту)
  //pace - скорость шага
  constructor(coords, distance, duration, temp) {
    super(coords, distance, duration);
    this.temp = temp;
    this.calculatePace();
    this._setDescription();
  }
  //min/km
  calculatePace() {
    this.pace = this.duration / this.distance;
  }
}

//класс Велик
class Cycling extends Workout {
  type = 'cycling';
  //climb - подьем
  //speed - скорость велика
  constructor(coords, distance, duration, climb) {
    super(coords, distance, duration);
    this.climb = climb;
    this.calculateSpeed();
    this._setDescription();
  }
  //km/h
  calculateSpeed() {
    this.speed = this.distance / this.duration / 60;
  }
}

//класс App у которого будут все методы
class App {
  #map;
  #mapEvent;
  #workouts = [];

  constructor() {
    this._init();
  }

  async _init() {
    await this._getPosition();
    this._getLocalStorageData();
    inputType.addEventListener('change', this._toggleClimbField);
    form.addEventListener('submit', this._newWorkout.bind(this));
    rmWorkouts.addEventListener('click', this._deleteAllWorkouts);
    containerWorkouts.addEventListener('click', this._moveToWorkout.bind(this));
    containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));
  }

  //первая функция которая отвечает за получения местоположения
  async _getPosition() {
    if (navigator.geolocation) {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      console.log(position);
      this._loadMap(position);
    } else {
      alert('cannot get ur geoposition');
    }
  }

  _loadMap(pos) {
    //деструктуризация широты и долготы
    const {
      coords: { latitude, longitude },
    } = pos;
    const coords = [latitude, longitude];
    //используем библотеку leaflet
    //передаем координаты в setView(), число 15 указывает на масштаб, чем больше тем ближе
    //сразу же после загрузки карты показывается текущее местоположение
    //так же присваеваем к переменной map нашу текущую карту по местоположению
    this.#map = L.map('map').setView(coords, 13);
    //это настройки самой карты, особо ковырять не нужно
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);
    //событие при клике карту
    //нажатие на карту
    //открывается форма
    //создаем переменную mapevent и присваиваем ему событие которое срабатывает при клике на любую точку карты
    this.#map.on('click', this._showForm.bind(this));
    return this.#map;
  }

  _showForm(e) {
    //событие клика на карту
    this.#mapEvent = e;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _toggleClimbField() {
    inputTemp.closest('.form__row').classList.toggle('form__row--hidden');
    inputClimb.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    //получение координат
    const { lat, lng } = this.#mapEvent.latlng;
    //функция для проверки что число не является нефактным значением(NaN бесконечность и тд)
    const areNumbers = (...numbers) =>
      numbers.every(num => Number.isFinite(num));
    //функция для проверки что число не является минусовым значением
    const areNumbersPositive = (...numbers) => numbers.every(num => num > 0);
    e.preventDefault();
    //получение данные из формы
    const workoutType = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    //создаем переменную которая будет меняться по ситуации от вида тренировки, и поможет закинуть в массив эту тренировку
    let workout;
    //если тренировка пробежа, создать обьект ранинг
    if (workoutType === 'running') {
      const temp = +inputTemp.value;
      //проверка валидности данных
      if (
        !areNumbers(distance, duration, temp) ||
        !areNumbersPositive(distance, duration, temp)
      )
        return alert('Введите положительное число');
      //создаем тренировку
      workout = new Running([lat, lng], distance, duration, temp);
    }
    //если тренировка велик, создать обьект сайклинг
    if (workoutType === 'cycling') {
      const climb = +inputClimb.value;
      //проверка валидности данных
      if (
        !areNumbers(distance, duration, climb) ||
        !areNumbersPositive(distance, duration)
      )
        return alert('Введите положительное число');
      //создаем тренировку
      workout = new Cycling([lat, lng], distance, duration, climb);
    }

    //добавить новый обьект в массив тренировок
    this.#workouts.push(workout);

    //отобразить тренировку на карте
    this._displayWorkout(workout);

    //отобразить тренировку в списке
    this._displayWorkoutOnSidebar(workout);

    //спрятать форму и очисить поле ввода
    this._hideForm();

    //Добавить все тренировки в локальное хранилище
    this._addWorkoutsToLocalStorage();

    //алерт для удачи
    document.querySelector('.good__luck').style.opacity = 0.8;
    setTimeout(function () {
      document.querySelector('.good__luck').style.opacity = 0;
    }, 5000);
  }

  _displayWorkout(workout) {
    //создание маркера для местоположения
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 200,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          //добавление стиля для маркера
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃' : '🚵‍♂️'} ${workout.desciption}`
      )
      .openPopup();
  }

  //отображение на боковой панели
  _displayWorkoutOnSidebar(workout) {
    let html = `<li class="workout workout--${workout.type}" data-id="${
      workout.id
    }">
    <h2 class="workout__title">${
      workout.desciption
    }<span class="workout__remove">❌</span></h2>
    <div class="workout__details">
      <span class="workout__icon">${
        workout.type === 'running' ? '🏃' : '🚵‍♂️'
      }</span>
      <span class="workout__value">${workout.distance}</span>
      <span class="workout__unit">км</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">⏱</span>
      <span class="workout__value">${workout.duration}</span>
      <span class="workout__unit">мин</span>
    </div>`;
    if (workout.type === 'running') {
      html += `<div class="workout__details">
    <span class="workout__icon">📏⏱</span>
    <span class="workout__value">${workout.pace.toFixed(2)}</span>
    <span class="workout__unit">мин/км</span>
  </div>
  <div class="workout__details">
    <span class="workout__icon">👟⏱</span>
    <span class="workout__value">${workout.temp}</span>
    <span class="workout__unit">шаг/мин</span>
  </div>
  </li>`;
    }
    if (workout.type === 'cycling') {
      html += `<div class="workout__details">
        <span class="workout__icon">📏⏱</span>
        <span class="workout__value">${workout.speed.toFixed(2)}</span>
        <span class="workout__unit">км/ч</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">🏔</span>
        <span class="workout__value">${workout.climb}</span>
        <span class="workout__unit">м</span>
      </div>
      </li>`;
    }

    document.querySelector('.workouts').insertAdjacentHTML('beforeend', html);
  }

  //скрыть форму
  _hideForm() {
    inputDistance.value =
      inputClimb.value =
      inputDuration.value =
      inputTemp.value =
        '';
    form.classList.add('hidden');
  }

  //при нажатии на список тренировок
  //когда нажимаем на определенную тренировку камера сразу перемещается туда
  _moveToWorkout(e) {
    const workoutElement = e.target.closest('.workout');
    if (!workoutElement) return;
    const workout = this.#workouts.find(
      value => value.id === workoutElement.dataset.id
    );
    //место тренировки
    this.#map.setView(workout.coords, 17, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  //добавление тренировок в локалку
  _addWorkoutsToLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  //при перезагрузке страницы вытаскивать данные из локалки
  _getLocalStorageData() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    if (!data) return;

    this.#workouts = data;
    this.#workouts.forEach(workout => {
      this._displayWorkoutOnSidebar(workout);
      this._displayWorkout(workout);
    });
  }

  //удаление всех тренировок
  _deleteAllWorkouts() {
    localStorage.removeItem('workouts');
    location.reload();
  }

  //удаление определенной тренировки
  _deleteWorkout(e) {
    if (e.target.classList.contains('workout__remove')) {
      const workoutInfo = e.target.closest('.workout');

      const targetWorkout = this.#workouts.find(
        value => value.id === workoutInfo.dataset.id
      );
      const allWorkouts = JSON.parse(localStorage.getItem('workouts'));
      if (!allWorkouts) return;
      const workoutIndex = allWorkouts.findIndex(
        value => value.id === targetWorkout.id
      );
      allWorkouts.splice(workoutIndex, 1);
      localStorage.clear();
      localStorage.setItem('workouts', JSON.stringify(allWorkouts));
      location.reload();
    }
  }
}

//запуск
const app = new App();
