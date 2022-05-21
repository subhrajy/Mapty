'use strict';

class Workout {
  // works on cutting edge JS (not on ES6), for ES6 refer to the declarations inside constructor (commented out)
  date = new Date();
  id = (Date.now() + ``).slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    // this.date = ...
    // this.id = ...
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks += 1;
  }
}

class Running extends Workout {
  type = `running`;

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // in min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = `cycling`;

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // in km/hr
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// EXPT
// const run1 = new Running([20, 85], 5.2, 24, 178);
// const cycling1 = new Cycling([20, 85], 27, 95, 523);
// console.log(run1);
// console.log(cycling1);

/////////////////////////////////////////////////////////////
// APPLICATION ARCHITECTURE

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const copyright = document.querySelector(`.copyright`);
const modalWindow = document.querySelector(`.modal`);
const modalHeading = document.querySelector(`.modal--heading`);
const modalMessage = document.querySelector(`.modal--message`);
const overlay = document.querySelector(`.overlay`);
const modalClose = document.querySelector(`.close--modal`);

let executed = false;
let executedMessage = false;
const bounds = L.latLngBounds();

class App {
  #map;
  #mapZoomLevel = 16;
  #mapEvent;
  #workouts = [];

  constructor() {
    //get user's position
    this._getPosition();

    // get data from local storage
    this._getLocalStorage();

    // attach event handlers
    form.addEventListener(`submit`, this._newWorkout.bind(this));
    inputType.addEventListener(`change`, this._toggleElevetionField);
    containerWorkouts.addEventListener(`click`, this._moveToPopup.bind(this));
    containerWorkouts.addEventListener(
      `dblclick`,
      this._editWorkouts.bind(this)
    );
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert(`could not get your position`);
        }
      );
    }
  }

  _loadMap(position) {
    // const { longitude } = position.coords;
    //   console.log(position);
    //   console.log(latitude, longitude);
    //   console.log(`https://www.google.com/maps/@${latitude},${longitude}`);

    const { latitude, longitude } = position.coords;
    const coords = [latitude, longitude];
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // adding click event listener
    this.#map.on(`click`, this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove(`hidden`);
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    // prettier-ignore
    inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = ``;

    // hide the form
    form.style.display = `none`;

    // add the hidden class
    form.classList.add(`hidden`);
    setTimeout(() => (form.style.display = `grid`), 1000);
  }

  _toggleElevetionField() {
    inputElevation.closest(`.form__row`).classList.toggle(`form__row--hidden`);
    inputCadence.closest(`.form__row`).classList.toggle(`form__row--hidden`);
  }

  _newWorkout(event) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));

    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    event.preventDefault();

    // get data from the form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // if running, create running obj
    if (type === `running`) {
      const cadence = +inputCadence.value;
      // check if valid
      if (
        // !Number.isFinite(distance) ||
        // !Number.isFinite(duration) ||
        // !Number.isFinite(cadence)
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        this._showError();
        return;
      }

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // if cycling, create cycling obj
    if (type === `cycling`) {
      const elevation = +inputElevation.value;
      // check if valid
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      ) {
        this._showError();
        return;
      }
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // add new obj to workout array
    this.#workouts.push(workout);

    // render workout on map as a marker
    this._renderWorkoutMarker(workout);

    // render workout on the list
    this._renderWorkout(workout);

    // hide the form and clear input fields
    this._hideForm();

    // set local storage to all workouts
    this._setLocalStorage();
  }

  _showError() {
    modalMessage.innerHTML = `
    Inputs can not be blank <br>
    Inputs have to be number and positive`;

    modalWindow.classList.remove(`hidden`);
    overlay.classList.remove(`hidden`);

    modalClose.addEventListener(`click`, this._hideModal);
    overlay.addEventListener(`click`, this._hideModal);
  }

  _hideModal() {
    modalWindow.classList.add(`hidden`);
    overlay.classList.add(`hidden`);
  }

  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === `running` ? `🏃` : `🚴`} ${workout.description}`
      )
      .openPopup();

    bounds.extend(workout.coords);
  }

  _renderWorkout(workout) {
    const instrHTML = `
      <p class="copyright">Double click on card to edit</p>
    `;

    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <span class="workout--delete">delete</span>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === `running` ? `🏃` : `🚴`
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>`;

    if (workout.type === `running`) {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>`;
    }

    if (workout.type === `cycling`) {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed()}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>
      `;
    }

    // render all workouts' list
    form.insertAdjacentHTML(`afterend`, html);

    // show edit message on top of the list
    if (!executedMessage) this._renderMessage(instrHTML);

    // delete all workouts
    if (!executed) this._showDeleteitem(this);
    this._deleteWorkout(this);

    // see all workout markers
    copyright.addEventListener(`click`, this._seeAllMarker.bind(this));
  }

  _renderMessage(instrHTML) {
    form.insertAdjacentHTML(`beforebegin`, instrHTML);
    executedMessage = true;
  }

  _seeAllMarker() {
    this.#map.fitBounds(bounds, {
      animate: true,
      pan: {
        duration: 0.55,
      },
    });
  }

  _deleteWorkout(thisObj) {
    function _deleteWorkout(event) {
      // console.log(event.target.closest(`.workout`));
      const workoutIndex = this.#workouts.findIndex(
        work => work.id === event.target.closest(`.workout`).dataset.id
      );
      this.#workouts.splice(workoutIndex, 1);

      localStorage.removeItem(`workouts`);
      localStorage.setItem(`workouts`, JSON.stringify(this.#workouts));
      location.reload();
    }

    const deleteWorkoutEl = document.querySelector(`.workout--delete`);

    deleteWorkoutEl.addEventListener(`click`, _deleteWorkout.bind(thisObj));
  }

  _showDeleteitem(thisObj) {
    function _deleteItems() {
      this.reset();
    }

    const deleteElementHTML = `
    <div class='delete'>
      <p>delete all</p>
    </div>
  `;

    copyright.insertAdjacentHTML(`beforebegin`, deleteElementHTML);

    const deleteButton = document.querySelector(`.delete`);
    deleteButton.addEventListener(`click`, _deleteItems.bind(thisObj));

    executed = true;
  }

  _moveToPopup(event) {
    const workoutEl = event.target.closest(`.workout`);

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
    // this.#map.setView(L.marker().getBounds().getCenter());
    // console.log(makersLayer);

    // using public interface
    workout.click(); // objects retrived from the local storage lose their prototype chain

    // see all workout markers
    // this.#map.fitBounds(bounds);
  }

  _setLocalStorage() {
    localStorage.setItem(`workouts`, JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem(`workouts`));

    if (!data) return;

    data.forEach(workout => {
      Object.setPrototypeOf(workout, new Workout());
    });

    this.#workouts = data;

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
      // this._renderWorkoutMarker(work); // _getLocalStorage is executed right after page loads, bu the map is not loaded yet, so we get an error.
    });
  }

  _editNumbers(workoutEl, workout, obj) {
    workout.distance = obj.newDistance;
    workout.duration = obj.newDuration;
    if (workout.type === `cycling`)
      workout.elevationGain = obj.newElevationGain;

    if (workout.type === `running`) workout.cadence = obj.newCadence;

    workoutEl.classList.remove(`workout--edit`);

    localStorage.setItem(`workouts`, JSON.stringify(this.#workouts));
    location.reload();
  }

  _editWorkouts(event) {
    const workoutEl = event.target.closest(`.workout`);

    if (!workoutEl) return;

    workoutEl.classList.add(`workout--edit`);

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    setTimeout(() => {
      const obj = this._askNewInputs(workout);
      this._editNumbers(workoutEl, workout, obj);
    }, 500);
  }

  _askNewInputs(workout) {
    const returnObj = {};
    returnObj.newDistance = prompt(`Enter new distance`);
    returnObj.newDuration = prompt(`Enter new duration`);

    if (workout.type === `cycling`) {
      returnObj.newElevationGain = prompt(`Enter new elevation gain`);
    }
    if (workout.type === `running`) {
      returnObj.newCadence = prompt(`Enter new cadence`);
    }

    return returnObj;
  }

  reset() {
    localStorage.removeItem(`workouts`);
    location.reload(); // location is a big object in the browser that contains a lot of properties and methods
  }
}

const app = new App();
